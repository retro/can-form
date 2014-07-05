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


	// When we create the form template in the top context,
	// we wrap it in the `form` element to get all the native
	// form behavior for free.
	var wrapSubtemplateInForm = function(subtemplate){
		var wrapped = stache('<form>{{{subtemplate}}}</form>');
		return function(){
			var args = can.makeArray(arguments);
			return wrapped({
				subtemplate : function(){ return subtemplate.apply(this, args); }
			});
		}
	}

	// Convert from `{foo}` to `foo`
	var getPath = function(path){
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

	// Function that handles all the heavy lifting for the form.
	// If user passes the `scope` to the form component we capture it
	// in the closure so we can create a layered scope. FormComponent
	// works a bit differently from the normal components and it creates 
	// two or three layers of scopes:
	// 
	// 1st layer: object holding all the meta info: current path, errors, dirtyAttributes and validations
	// 2nd layer: if the `scope` object was passed in set it here
	// 3rd layer: object passed in the `map` property
	// 
	// This ensures that context inside the form component is always set to whatever was passed in as
	// a `map` while still being able to get all the data set in the scope
	// 
	// It is useful when you want to load some form data that is not directly related to a model
	// (a list to populate the select element or something similar)
	// 
	// This function also handles all the stuff that is needed for nested forms. When using the FormComponent
	// you can nest forms one inside the other, but the behavior is handled by the outermost form.
	// 
	// This way you can reuse forms in any needed context.
	// 
	var makeSetup = function(passedInScope){

		return function(el, hookupOptions){
			var scope       = hookupOptions.scope,
				context     = scope._context,
				path        = getPath(el.getAttribute('path') || el.getAttribute('map')),
				parentPath  = scope.attr('__path'),
				currentPath = parentPath ? [parentPath, path].join('.') : path,
				opts        = {},
				validations = [],
				dirtyAttrs  = scope.attr('__dirtyAttrs') || [],
				mapConstructor, passedInScopeInstance;

			if(!scope.attr('__form')){
				// If we are in the top level form set all the metadata needed for the form
				opts.__form = true;
				opts.__errors = scope.attr(getPath(el.getAttribute('errors'))) || can.compute();
				opts.__dirtyAttrs = dirtyAttrs;
				opts.__addValidation = function(rulesFn){
					validations.push(rulesFn);
				}
				// Wrap the form in the `form` element
				hookupOptions.subtemplate = wrapSubtemplateInForm(hookupOptions.subtemplate);
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
			if(!scope._parent){
				hookupOptions.scope = (new can.view.Scope(opts));
			} else {
				hookupOptions.scope = scope._parent.add(opts);
			}


			// If the form was created with the `scope` option, create another data layer
			if(passedInScope){
				// For plain object we create an extended onstructor function and initialize it
				if(_isPlainObject(passedInScope)){
					mapConstructor = (this.Map || can.Map).extend({}, passedInScope);
					passedInScopeInstance = new mapConstructor;
				} else {
					// Otherwise it's an instance or a constructor function
					if(passedInScope instanceof can.Map){
						passedInScopeInstance = passedInScope;
					} else {
						passedInScopeInstance = new passedInScope;
					}
				}
				hookupOptions.scope = hookupOptions.scope.add(passedInScopeInstance);
			}


			// Finally add the context as the last layer of the scope
			hookupOptions.scope = hookupOptions.scope.add(context);

			// When `attributes` event is triggered we check if the `path` was changed
			// and update all places where we keep the paths of the current nested forms.
			can.bind.call(el, "attributes", function (ev) {
				var path, oldPath;
				if(ev.attributeName === 'path' && opts.__path){
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
				this._control.__errors     = opts.__errors;
				this._control.__dirtyAttrs = opts.__dirtyAttrs;
				this._control.validations  = validations;
			}
			
		}
	}

	var componentOpts = {
		// Here we setup the validations and return whatever was passed in the `map` object
		// as a scope
		scope : function(attrs, parentScope, el){
			parentScope.attr('__addValidation')(
				makeValidator(attrs.map, this.validate, parentScope.attr('__path'))
			);
			return attrs.map;
		},
		// We use the control instance on the component to handle error reporting
		events : {
			"{scope} change" : function(scope, ev, path, how){
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
			}
		},
		// Error helper that renders the errors for the data path. It keeps track
		// of the current path of the context and knows which errors should be shown.
		helpers : {
			errors : function(attr, opts){
				var path, currentPath, fullPath, errors;

				if(arguments.length === 1){
					opts = attr;
					attr = null;
				} else {
					attr = can.isFunction(attr) ? attr() : attr;
				}

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
		var passedInScope = opts.scope;

		delete opts.scope;

		if(!opts.template){
			throw new FormComponentError("You must provide the `template` option to the FormComponent");
		}
		if(!opts.tag){
			throw new FormComponentError("You must provide the `tag` option to the FormComponent");
		}

		return Component.extend(_merge({setup : makeSetup(passedInScope)}, componentOpts, opts));
	}

	FormComponent.extend = FormComponent;
	FormComponent.validationRules = Validator.rules;

	// Create the simplest implementation of the FormComponent, useful for the ad-hoc forms
	FormComponent({
		tag:'form-for',
		template : stache('<content></content>')
	});

	return FormComponent;

});