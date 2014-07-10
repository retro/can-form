define(['can-form', './simple_login.stache!'], function(FormComponent, initView){

	FormComponent.extend({
		tag : 'simple-login',
		template : initView,
		validate : {
			email : [
				FormComponent.validationRules.presenceOf(),
				FormComponent.validationRules.formatOf(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
			],
			password : [FormComponent.validationRules.presenceOf()],
		}
	});

});