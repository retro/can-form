define([
'can/construct/',
'lodash/objects/isUndefined',
'lodash/objects/isEmpty',
'lodash/objects/isFunction',
'lodash/arrays/compact',
'lodash/collections/map',
'lodash/objects/isPlainObject',
'lodash/collections/forEach',
'lodash/objects/isString',
'lodash/objects/transform',
'lodash/arrays/flatten',
'lodash/objects/keys',
'lodash/arrays/indexOf',
], function (Construct, _isUndefined, _isEmpty, _isFunction, _compact, _map, _isPlainObject, _each, _isString, _transform, _flatten, _keys, _indexOf){

	var ValidatorError = function (message){
		this.message = message;
		this.stack = (new Error()).stack;
	}

	ValidatorError.prototype      = new Error; 
	ValidatorError.prototype.name = 'ValidatorError'; 

	var validateTree = function (current, path, rules, rulesets, prevPath, instance){

		var currentAttr = path.shift(),
			childErrors = {},
			errors      = {},
			iterCurrent, proxyPath, nestedErrors, joinedPrevPath;

		if(currentAttr === '*'){
			if(current){
				for(var i = 0; i < current.attr('length'); i++){
					proxyPath = prevPath.slice(0);
					proxyPath.push(i);
					iterCurrent = current.attr(i);

					childErrors = validateTree(iterCurrent, path.slice(0), rules, rulesets, proxyPath, instance);
					addErrors(errors, childErrors);
				}
			}
		} else {
			current = _isUndefined(current) ? undefined : (current.attr ? current.attr(currentAttr) : current);
			currentAttr && prevPath.push(currentAttr);

			if(_isEmpty(path)){
				
				joinedPrevPath = prevPath.join('.');

				childErrors = _compact(_map(rules, function (rule){
					var error = rule.call(instance, current, joinedPrevPath);
					if(!_isUndefined(error)){
						return error;
					}
				}));

				if(!_isEmpty(childErrors)){
					errors[joinedPrevPath] = childErrors;
				}

			} else {

				childErrors = validateTree(current, path, rules, rulesets, prevPath, instance);

				if(!_isEmpty(childErrors)){
					if(_isPlainObject(childErrors)){
						addErrors(errors, childErrors);
					} else {
						errors = childErrors;
					}
				}
			}
		}

		return errors;
	}

	var addErrors = function (errors, newErrors){
		_each(newErrors, function (e, attr){
			if(_isUndefined(errors[attr])){
				errors[attr] = [];
			}
			errors[attr].push.apply(errors[attr], (_isString(e) ? [e] : e));
		})
		return errors;
	}

	var Validator = Construct.extend({
		init : function (rules){
			this.rules = {};

			rules.call(this);
		},
		addRule : function (attr, rule){
			var rulePair = can.trim(attr).split(':'),
			ruleSet  = rulePair.length === 2 ? rulePair[0] : '_default_',
			ruleAttr = rulePair.pop();

			ruleSet = (ruleSet === 'default') ? '_default_' : ruleSet;

			this.rules[ruleSet]           = this.rules[ruleSet] || {};
			this.rules[ruleSet][ruleAttr] = this.rules[ruleSet][ruleAttr] || [];
			
			this.rules[ruleSet][ruleAttr].push(this._resolveRule(rule));
		},
		
		validate : function (instance, ruleset){
			var errors   = {},
				self     = this,
				attributes, treeErrors;

			_each(this.rules['_default_'], function (rules, attr){
				var value, attrErrors, path, current, currentAttr, attr;

				if(attr === '*') {
					value = instance;
					_each(rules, function (rule){
						var error = rule.call(instance, value, attr);
						if(!_isUndefined(error)){
							if(!_isPlainObject(error)){
								throw new ValidatorError('Validators that operate on the whole object (defined with the `*`) MUST return the object with the attribute => error pairs');
							}
							errors = addErrors(errors, error);
						}
					});
				} else {
					treeErrors = validateTree(instance, attr.split('.'), rules, ruleset, [], instance);
					errors     = addErrors(errors, treeErrors);
				}
			});

			return _isEmpty(errors) ? null : errors;
		},
		_resolveRule : function (rule){
			var resolved;
			if(_isFunction(rule)){
				return rule;
			} else {
				resolved = Validator.rules[rule];
				if(_isUndefined(resolved)){
					throw new ValidatorError("Rule with the name `" + rule + "` doesn't exist.");
				} else {
					return resolved();
				}
			}
		}
	})

	var ValidatorContext = function (Model, rules){
		var validator = new Validator(Model, rules);

		return {
			errors : function(model, ruleset){
				return validator.validate(model, ruleset);
			},
			attrErrors : function(model, attr, ruleset){
				var errors = this.errors(model, ruleset),
					subset = {};

				if(_isString(attr)){
					attr = [attr];
				}

				_each(attr, function(a){
					if(errors[a]){
						subset[a] = errors[a];
					}
				})

				return _isEmpty(subset) ? null : subset;
			},
			isValid : function(model, ruleset){
				return this.errors(model, ruleset) === null;
			},
			attrIsValid : function(model, attr, ruleset){
				return this.attrErrors(model, attr, ruleset) === null;
			}
		}

	}

	ValidatorContext.messages = {
		presenceOf     : "can't be empty",
		formatOf       : "is invalid",
		inclusionOf    : "is not a valid option (perhaps out of range)",
		lengthOf       : "has wrong length",
		rangeOf        : "is out of range",
		numericalityOf : "must be a number"
	}

	ValidatorContext.rules = {
		presenceOf : function (message){

			message = message || ValidatorContext.messages.presenceOf;

			return function (value, path){
				if (typeof value == 'undefined' || value === "" || value === null) {
					return message;
				}
			}
		},
		formatOf : function (regexp, message) {

			if(arguments.length < 1){
				throw new ValidatorError('Validation `formatOf` requires `regexp <RegExp>` as the first argument');
			}

			message = message || ValidatorContext.messages.formatOf;

			return function (value, path){
				var check = (typeof value !== 'undefined' && value !== null && value !== '');
				if (check && String(value).match(regexp) == null) {
					return message;
				}
			}
		},
		inclusionOf : function (inArray, message){

			if(arguments.length < 1){
				throw new ValidatorError('Validation `inclusionOf` requires `inArray <Array>` as the first argument');
			}

			message = message || ValidatorContext.messages.inclusionOf;

			return function (value, path) {
				if (typeof value == 'undefined') {
					return;
				}

				for(var i = 0; i < inArray.length; i++) {
					if(inArray[i] == value) {
						return;
					}
				}

				return message;
			}
		},
		lengthOf : function (min, max, message){

			if(arguments.length < 2){
				throw new ValidatorError('Validation `lengthOf` requires `min <Integer>` as the first and `max <Integer>` as the second arugment');
			}

			message = message || ValidatorContext.messages.lengthOf;

			return function (value, path){
				if (((typeof value === 'undefined' || value === null) && min > 0) ||
						(typeof value !== 'undefined' && value !== null && value.length < min)) {
					return message + " (min = " + min + ")";
				} else if (typeof value != 'undefined' && value !== null && value.length > max) {
					return message + " (max = " + max + ")";
				}
			}
		},
		rangeOf : function (low, hi, message){

			if(arguments.length < 2){
				throw new ValidatorError('Validation `rangeOf` requires `low <Integer>` as the first and `hi <Integer>` as the second arugment');
			}

			message = message || ValidatorContext.messages.rangeOf;

			return function (value, path){
				if (((typeof value == 'undefined' || value === null) && low > 0) ||
						(typeof value !== 'undefined' && value !== null && (value < low || value > hi) )) {
					return message + " [" + low + "," + hi + "]";
				}
			}
		},
		numericalityOf : function (message){

			message = message || ValidatorContext.messages.numericalityOf;

			return function (value, path){
				var res = !isNaN(parseFloat(value)) && isFinite(value);
				if (!res) {
					return message;
				}
			}
		}
	}

	return ValidatorContext;
})