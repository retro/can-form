define([
'can/construct',
'can/component',
'can/view/stache',
'lib/validator',
'lodash/objects/merge',
'lodash/objects/transform',
'lodash/objects/isArray',
'lodash/objects/isFunction',
'lodash/objects/isEmpty',
'lodash/objects/keys',
'lodash/collections/map',
'lodash/collections/forEach',
'lodash/collections/contains',
'lodash/arrays/compact',
'can/construct/super',
'can/construct/proxy'
], function(Construct, Component, stache, Validator, _merge, _transform, _isArray, _isFunction, _isEmpty, _keys, _map, _each, _contains, _compact){


	var wrapSubtemplateInForm = function(subtemplate){
		var wrapped = stache('<form>{{{subtemplate}}}</form>');
		return function(){
			var args = can.makeArray(arguments);
			return wrapped({
				subtemplate : function(){ return subtemplate.apply(this, args) }
			});
		}
	}

	var getPath = function(path){
		return path.replace(/^\{/, '').replace(/\}$/, '');
	}

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


	Component({
		tag:'form-for',
		template : stache('<content></content>'),
		validate : {
			'username' : [Validator.rules.presenceOf()]
		},
		scope : function(attrs, parentScope, el){
			parentScope.attr('__addValidation')(
				makeValidator(attrs.map, this.validate, parentScope.attr('__path'))
			);
			return attrs.map;
		},
		setup : function(el, hookupOptions){
			var scope = hookupOptions.scope,
				context = scope._context,
				path = getPath(el.getAttribute('path') || el.getAttribute('map')),
				parentPath = scope.attr('__path'),
				currentPath = parentPath ? [parentPath, path].join('.') : path,
				opts = {},
				validations = [],
				dirtyAttrs = scope.attr('__dirtyAttrs') || [];

			if(!scope.attr('__form')){
				// We're in the top form context
				opts.__form = true;
				opts.__errors = can.compute();
				opts.__dirtyAttrs = dirtyAttrs;
				opts.__addValidation = function(rulesFn){
					validations.push(rulesFn);
				}
				hookupOptions.subtemplate = wrapSubtemplateInForm(hookupOptions.subtemplate);
				this.helpers.inMainForm = function(opts){
					return opts.fn()
				}
			} else {
				opts.__path = can.compute(currentPath);
				opts.__form = false;
				this.helpers.inMainForm = can.noop;
			}

			if(!scope._parent){
				hookupOptions.scope = (new can.view.Scope(opts)).add(context);
			} else {
				hookupOptions.scope = scope._parent.add(opts).add(context);
			}

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

			this._super.apply(this, arguments);

			if(opts.__form){
				this._control.__form       = opts.__form;
				this._control.__errors     = opts.__errors;
				this._control.__dirtyAttrs = opts.__dirtyAttrs;
				this._control.validations  = validations;
			}
			
		},
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
				this.__formWasSubmitted = true;
				var errors = this.validate(true);
				
				if(_isEmpty(errors)){

				}

				ev.preventDefault();
			},
			validate : function(validateAll){
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
				path = _isFunction(path) ? path() : path;

				errors   = opts.scope.attr('__errors')() || {};
				fullPath = _compact([path, attr]).join('.');

				if(fullPath){
					errors = errors[fullPath];
				}

				return !_isEmpty(errors) ? opts.fn(opts.scope.add(errors)) : null;
			}
		}
	})

})