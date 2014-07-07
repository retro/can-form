define([
'can/construct',
'can/component',
'can/view/stache',
'lib/validator',
'lodash/objects/merge',
'lodash/objects/transform',
'lodash/objects/isArray',
'lodash/objects/isEmpty',
'lodash/objects/isPlainObject',
'lodash/objects/keys',
'lodash/collections/map',
'lodash/collections/forEach',
'lodash/collections/contains',
'lodash/arrays/compact',
'can/construct/super',
'can/construct/proxy'
], function(Construct, Component, stache, Validator, _merge, _transform, _isArray, _isEmpty, _isPlainObject, _keys, _map, _each, _contains, _compact){

	// Custom FormComponent Error object
	var FormComponentError = function (message){
		this.message = message;
		this.stack = (new Error()).stack;
	}

	FormComponentError.prototype      = new Error; 
	FormComponentError.prototype.name = 'FormComponentError'; 

	
	var templates = {
		withForm : stache('<form>{{#__ctx}}{{{__subtemplate}}}{{/__ctx}}</form>'),
		withoutForm : stache('{{#__ctx}}{{{__subtemplate}}}{{/__ctx}}')
	};

	// When we create the form template in the top context,
	// we wrap it in the `form` element to get all the native
	// form behavior for free.
	var wrapSubtemplateInFormScope = function(subtemplate){
		var isTopLevel

		var res = function(){
			
			var args        = can.makeArray(arguments),
				scope       = args[0],
				tagsHelpers = args[1],
				wrapped = templates[isTopLevel() ? 'withForm' : 'withoutForm'];
			return wrapped({}, {
				__ctx : function(opts){
					return opts.fn(scope.add(scope.attr('map')));
				},
				__subtemplate : function(opts){
					return subtemplate(opts.scope, tagsHelpers);
				}
			});
		}

		res.isTopLevel = isTopLevel = can.compute(false);

		return res;
	}

	// Convert from `{foo}` to `foo`
	var getPath = function(path){
		if(!path){
			return "";
		}
		return path.replace(/^\{/, '').replace(/\}$/, '');
	}

	// Creates a function that validates the model passed to the
	// form
	var makeValidator = function(model, rules, path){
		var validator;
		return function(){
			var errors, realPath;

			validator = validator || Validator(function(){
				var self = this;
				_each(rules, function(validations, attr){
					if(_isArray(validations)){
						_each(validations, function(validation){
							self.addRule(attr, validation);
						})
					} else {
						self.addRule(attr, validations);
					}

				})
			});

			errors = validator.errors(model);

			if(path){
				realPath = path();
				errors = _transform(errors, function(result, errors, key){
					result[[realPath, key].join('.')] = errors;
				});
			}
			return errors;
		}
	}

	var getScope = function(attr, context){
		if(attr === 'this' || attr === '.'){
			return context;
		}
		return context.attr ? context.attr(attr) : context[attr];
	}

	var FormStates = {
		CLEAN   : 'clean',
		SAVING  : 'saving',
		SAVED   : 'saved',
		INVALID : 'invalid',
		VALID   : 'valid'
	};

	var FormScope = can.Map.extend({}, {
		save : function(){
			var promise;
			this.attr('state', FormStates.SAVING);
			promise = this.attr('map').save();
			console.log(promise)
			promise.then(this.proxy('saved'), this.proxy('errored'));
		},
		saved : function(data){
			this.attr('state', FormStates.SAVED);
		},
		errored : function(err){
			this.attr('state', FormStates.INVALID);
			this.setErrors(this.parseErrors(err));
		},
		parseErrors : function(errors){
			return errors;
		}
	})

	var isMapThis = function(attr){
		attr = attr.replace(/\s/g, '');
		return (attr === '{this}' || attr === '{.}');
	}

	var blacklistedAttrs = ['map', 'path', 'errors'];

	var makeScope = function(passedInScope){
		return  function(attrs, parentScope, el){
			var Scope, BaseScope;

			parentScope.attr('__addValidation')(
				makeValidator(attrs.map, this.validate, parentScope.attr('__path'))
			);

			delete attrs.path;

			BaseScope = parentScope.attr('__form') ? FormScope : can.Map;


			Scope = passedInScope ? BaseScope.extend(passedInScope) : BaseScope;


			var scope = new (Scope.extend(attrs));

			return scope;
		}
	}

	var componentOpts = {
		setup : function(el, hookupOptions){

			var scope       = hookupOptions.scope,
				isTopLevel  = typeof hookupOptions.scope.attr("__form") === 'undefined',
				context     = scope._context,
				attr        = getPath(el.getAttribute('map')), 
				path        = getPath(el.getAttribute('path') || attr),
				parentPath  = scope.attr('__path'),
				currentPath = parentPath ? [parentPath, path].join('.') : path,
				opts        = {},
				validations = [],
				dirtyAttrs  = scope.attr('__dirtyAttrs') || [],
				mapConstructor;

			var s = hookupOptions.subtemplate

			if(isTopLevel){
				// If we are in the top level form set all the metadata needed for the form
				opts.__form = true;
				opts.__errors = scope.attr(getPath(el.getAttribute('errors'))) || can.compute();
				opts.__dirtyAttrs = dirtyAttrs;
				opts.__addValidation = function(rulesFn){
					validations.push(rulesFn);
				}
				// `inMainForm` helper will render it's contents for this context
				this.helpers.inMainForm = function(opts){
					return opts.fn()
				}
			} else {
				// Current path of the data in the form. This is needed for the error reporting
				opts.__path = can.compute(currentPath);
				opts.__form = false;
				// `inMainForm` helper does nothing in this case
				this.helpers.inMainForm = can.noop;
			}


			// Create first scope layer - the one holding the metadata
			if(isTopLevel){
				hookupOptions.scope = (new can.view.Scope(opts));
			} else {
				hookupOptions.scope = scope._parent.add(opts);
			}

			this.template.isTopLevel(isTopLevel);
			hookupOptions.scope = hookupOptions.scope.add(context);

			// When `attributes` event is triggered we check if the `path` was changed
			// and update all places where we keep the paths of the current nested forms.
			can.bind.call(el, "attributes", function (ev) {
				var attr = ev.attributeName,
					path, oldPath;

				if(attr === 'path' && opts.__path){
					path = el.getAttribute('path');
					path = parentPath ? [parentPath, path].join('.') : path;
					oldPath = ev.oldValue;

					opts.__path(path);

					for(var i = 0; i < dirtyAttrs.length; i++){
						if(dirtyAttrs[i].indexOf(oldPath) === 0){
							dirtyAttrs[i] = dirtyAttrs[i].replace(oldPath, path);
						}
					}
					ev.stopImmediatePropagation();
				}
			});

			// call the `can.Component.prototype.setup` function which will setup
			// the component
			Component.prototype.setup.apply(this, arguments);

			// If we are in the top level form, add some objects to the control instance
			if(opts.__form){
				this._control.__form       = opts.__form;
				this._control.__dirtyAttrs = opts.__dirtyAttrs;
				this._control.__errors     = opts.__errors;
				this._control.validations  = validations;
				this._control.bindErrors(opts.__errors);
				this._control.scope.attr('state', FormStates.CLEAN);
				this._control.scope.setErrors = function(errors){
					opts.__errors(errors)
				}
			}

		},
		// We use the control instance on the component to handle error reporting
		events : {
			"{scope.map} change" : function(scope, ev, path, how){
				if(this.__form){
					if(how === 'set'){
						if(!_contains(this.__dirtyAttrs, path)){
							this.__dirtyAttrs.push(path);
						}
					}
					clearTimeout(this.__validationTimeout);
					this.__validationTimeout = setTimeout(this.proxy('validate'), 1);
				}
			},
			"form submit" : function(el, ev){
				if(this.__form){
					this.__formWasSubmitted = true;
					var errors = this.validate(true);
					
					if(_isEmpty(errors)){
						this.scope.save()
					}

					ev.preventDefault();
				}
			},
			validate : function(validateAll){
				if(this.__form){
					var allErrors = {},
					self = this;

					_each(this.validations, function(fn){
						var errors = fn();
						if(errors && !_isEmpty(errors)){
							_each(errors, function(error, key){
								if(validateAll || _contains(self.__dirtyAttrs, key)){
									if(allErrors[key]){
										allErrors[key].push.apply(allErrors[key], error);
									} else {
										allErrors[key] = error;
									}
								}
							})
						}
					});

					if(this.__formWasSubmitted){
						_each(_keys(allErrors), function(path){
							if(!_contains(self.__dirtyAttrs, path)){
								self.__dirtyAttrs.push(path);
							}
						});
						delete this.__formWasSubmitted;
					}

					this.__errors(allErrors);

					return allErrors;
				}
			},
			bindErrors : function(errors){
				var self = this;
				this.on(errors, 'change', function(ev, newVal, oldVal){
					self.scope.attr('state', _isEmpty(newVal) ? FormStates.VALID : FormStates.INVALID);
				});
			}
		},
		// Error helper that renders the errors for the data path. It keeps track
		// of the current path of the context and knows which errors should be shown.
		helpers : {
			errors : function(){
				var args = can.makeArray(arguments),
					attr, opts, path, currentPath, fullPath, errors;


				opts = args.pop();
				attr = _map(args.length > 0 ? args : [], function(a){
					return can.isFunction(a) ? a() : a;
				}).join('.');


				path = opts.scope.attr('__path');
				path = can.isFunction(path) ? path() : path;

				errors   = opts.scope.attr('__errors')() || {};
				fullPath = _compact([path, attr]).join('.');

				if(fullPath){
					errors = errors[fullPath];
				}

				return !_isEmpty(errors) ? opts.fn(opts.scope.add(errors)) : null;
			}
		}
	}

	// Emulate the `can.Construct` API for the FormComponent
	var FormComponent = function(opts){
		var passedInScope = opts.scope,
			finalOpts;

		delete opts.scope;

		if(!opts.template){
			throw new FormComponentError("You must provide the `template` option to the FormComponent");
		}
		if(!opts.tag){
			throw new FormComponentError("You must provide the `tag` option to the FormComponent");
		}

		if(opts.helpers){
			componentOpts.helpers = _merge({}, componentOpts.helpers, opts.helpers);
			delete opts.helpers;
		}

		opts.template = wrapSubtemplateInFormScope(opts.template);

		finalOpts = _merge({scope : makeScope(passedInScope)}, componentOpts, opts);

		return Component.extend(finalOpts);
	}

	FormComponent.extend = FormComponent;
	FormComponent.validationRules = Validator.rules;
	FormComponent.Scope = FormScope;

	// Create the simplest implementation of the FormComponent, useful for the ad-hoc forms
	FormComponent({
		tag:'form-for',
		template : stache('<content></content>')
	});

	return FormComponent;

});