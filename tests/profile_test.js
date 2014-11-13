steal('can/model','examples/forms/user_profile.js', function(Model){
	return function(q){
		q.module('Profile', {
			setup : function(){
				var UserModel = Model.extend({}, {});

				$('#qunit-test-area').html(can.stache('<user-profile map="{user}"></user-profile>')({
					user : new UserModel
				}))

				$('form').attr('autocomplete', 'off')
			}
		});

		test('Submitting the form will show the errors', function(){
			F('button[type=submit]').click();
			ok(F('ul.bg-danger').size(2), 'Errors are shown');

		})

		test('Adding username will show only one error', function(){
			F('[can-value="username"]').type('retro\r');
			F('button[type=submit]').click();
			ok(F('ul.bg-danger').size(1), 'Only one error is shown');
		})

		test('Adding an empty phone number will add an error', function(){
			F('[can-click=addPhoneNumber]').click();
			F('button[type=submit]').click();
			ok(F('ul.bg-danger').size(3), 'Only one error is shown');
		})

		test('Adding an empty social network number will add an errors', function(){
			F('[can-click=addSocialNetwork]').click();
			F('button[type=submit]').click();
			ok(F('ul.bg-danger').size(4), 'Only one error is shown');
		})

	}
})