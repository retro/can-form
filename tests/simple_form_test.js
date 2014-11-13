steal('can/model','examples/forms/simple_login.js', function(Model){
	return function(q){
		q.module('Simple Form', {
			setup : function(){
				var UserModel = Model.extend({}, {});

				$('#qunit-test-area').html(can.stache('<simple-login map="{user}"></simple-login>')({
					user : new UserModel
				}))

				$('form').attr('autocomplete', 'off')
			}
		});

		q.test('Clicking submit will show errors', function(){
			F('button[type=submit]').click();
			ok(F('ul.bg-danger').exists(), 'Errors are shown');
		})

		q.test('Filling incorrect data will show errors', function(){
			F('[can-value="email"]').type('foo\r');
			F('#password').type('bar\r');
			F('button[type=submit]').click();
			ok(F('ul.bg-danger').size(1), 'Errors are shown only for the email field')
		})
	}
})