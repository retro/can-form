steal('lib/validator.js', 'can/map',  function(Validator, Map) {
	return function(q) {

		q.module('Validator')

		q.test('Simple validations', function() {
			var User = Map.extend({}), user;

			var validator = Validator(function(){
				this.addRule('name', 'presenceOf');
				this.addRule('*', function(){
					return {
						foo : 'bar'
					}
				})
			});

			user = new User;

			deepEqual(validator.errors(user), {
				name : ["can't be empty"],
				foo  : ['bar']
			})

		});

		

		q.test('Nested validations', function() {
			var User = Map.extend({}), user, validator;

			validator = Validator(function(){
				this.addRule('socialMedia.*.username', 'presenceOf');
				this.addRule('followers.*', 'presenceOf')
			});

			user = new User({
				socialMedia : [{
					service  : 'twitter',
					username : 'foo'
				}, {
					service  : 'github'
				}],
				followers : ['foo', 'bar', 'baz', '']
			});

			deepEqual(validator.errors(user), {
				'socialMedia.1.username' : ["can't be empty"],
				'followers.3' : ["can't be empty"]
			})

		});


		test('Built in validations', function(){
			var User = Map.extend({}), user, validator;

			validator = Validator(function(){
				this.addRule('name', Validator.rules.presenceOf());
				this.addRule('years', Validator.rules.rangeOf(13, 120));
				this.addRule('phoneAreaNumber', Validator.rules.formatOf(/\d{2,3}/))
				this.addRule('phoneNumber', Validator.rules.lengthOf(6, 7))
				this.addRule('salutation', Validator.rules.inclusionOf(['Mr']))
				this.addRule('car', Validator.rules.inclusionOf(['Ford', 'Mazda']))
				this.addRule('motorcycle', Validator.rules.inclusionOf(['Honda', 'Tomos']))
				this.addRule('ssn', Validator.rules.lengthOf(1, 10))
				this.addRule('streetNumber', Validator.rules.numericalityOf())
			})

			user = new User({
				name : '',
				years : 150,
				phoneAreaNumber : 'foo',
				phoneNumber : '3',
				salutation : 'Ms',
				ssn : '12345678901234567890',
				car : 'Ford',
				streetNumber : '1a'
			})

			deepEqual(validator.errors(user), {
				"name"            : ["can't be empty"],
				"phoneAreaNumber" : ["is invalid"],
				"salutation"      : ["is not a valid option (perhaps out of range)"],
				"ssn"             : ["has wrong length (max = 10)"],
				"streetNumber"    : ["must be a number"],
				"years"           : ["is out of range [13,120]"],
				"phoneNumber"     : ["has wrong length (min = 6)"]
			});
		})

		test('Validating lists', function(){
			var Users = can.List.extend({}), users, validator;

			validator = Validator(function(){
				this.addRule('*.username', 'presenceOf')
			})

			users = new Users([{
				username : 'foo'
			}, {
				username : 'bar'
			}, {
				email : 'foo@bar.baz'
			}])

			deepEqual(validator.errors(users), {
				'2.username' : ["can't be empty"]
			})

		})

		test('Validating list of strings', function(){
			var User = Map.extend({}), user, validator;

			validator = Validator(function(){
				this.addRule('visitedCities.*', 'presenceOf')
			})

			user = new User({
				visitedCities : ['Zagreb', 'Paris', '']
			})

			deepEqual(validator.errors(user), {
				'visitedCities.2' : ["can't be empty"]
			})
		})

		test('isValid / isAttrValid', function(){
			var User = Map.extend({}), user, validator;

			validator = Validator(function(){
				this.addRule('name', 'presenceOf')
			})

			user = new User;

			ok(!validator.isValid(user))

			ok(!validator.attrIsValid(user, 'name'))
		})
	};
});