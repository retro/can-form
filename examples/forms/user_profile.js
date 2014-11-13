define(['can-form', './user_profile.stache!'], function(FormComponent, initView){

	var phoneRe = /\(?([0-9]{3})\)?([ .-]?)([0-9]{3})\2([0-9]{4})/;

	FormComponent.extend({
		tag : 'user-profile',
		template : initView,
		validate : {
			username : [FormComponent.validationRules.presenceOf()],
			phoneNumbers : [FormComponent.validationRules.lengthOf(3, Infinity)],
			'phoneNumbers.*' : [
				FormComponent.validationRules.formatOf(phoneRe),
				FormComponent.validationRules.presenceOf()
			],
			'socialNetworks.*.name' : [
				FormComponent.validationRules.presenceOf()
			],
			'socialNetworks.*.username' : [
				FormComponent.validationRules.presenceOf()
			]
		},
		scope : {
			addPhoneNumber : function(ctx, el, ev){
				if(!this.attr('map.phoneNumbers')){
					this.attr('map.phoneNumbers', []);
				}
				this.attr('map.phoneNumbers').push('');
				ev.preventDefault();
			},
			addSocialNetwork : function(ctx, el, ev){
				if(!this.attr('map.socialNetworks')){
					this.attr('map.socialNetworks', []);
				}
				this.attr('map.socialNetworks').push({
					name : "",
					username : ""
				});
				ev.preventDefault();
			}
		}
	});

});