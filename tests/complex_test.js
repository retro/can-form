steal('can/model','examples/forms/article_form.js', function(Model){
	return function(q){
		var modelInstance;
		q.module('Complex', {
			
			setup : function(){
				var ArticleFormModel = Model.extend({}, {
					init : function(){
						this.attr('parts', [])
					}
				});

				modelInstance = new ArticleFormModel;

				$('#qunit-test-area').html(can.stache('<article-form map="{article}"></article-form>')({
					article : modelInstance
				}))

				$('form').attr('autocomplete', 'off')
			}
		});

		q.test('Each subcomponent has validations set up', function(){
			F('[can-click=addPara]').click();
			F('[can-click=addQuote]').click();
			F('[can-click=addSubtitle]').click();
			F('[type=submit]').click();
			ok(F('ul.bg-danger').size(4), 'Each item has errors shown');
		})

	}
});