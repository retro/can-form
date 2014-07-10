define([
'can-form',
'./article_form_views/article_form.stache!',
'./article_form_views/para.stache!',
'./article_form_views/quote.stache!',
'./article_form_views/subtitle.stache!',
'ui/sortable',
], function(FormComponent, initView, paraView, quoteView, subtitleView){

	FormComponent.extend({
		tag : 'article-quote',
		template : quoteView,
		validate : {
			author : [FormComponent.validationRules.presenceOf()],
			quote : [FormComponent.validationRules.presenceOf()]
		}
	})

	FormComponent.extend({
		tag : 'article-para',
		template : paraView,
		validate : {
			content : [FormComponent.validationRules.presenceOf()]
		}
	})

	FormComponent.extend({
		tag : 'article-subtitle',
		template : subtitleView,
		validate : {
			content : [FormComponent.validationRules.presenceOf()]
		}
	})

	FormComponent.extend({
		tag : 'article-form',
		template : initView,
		validate : {
			parts : [FormComponent.validationRules.lengthOf(1, Infinity)]
		},
		scope : {
			addPara : function(){
				this.attr('map.parts').push({
					type : 'para',
					content : ""
				});
			},
			addQuote : function(){
				this.attr('map.parts').push({
					type : 'quote',
					author : "",
					quote : ""
				});
			},
			addSubtitle : function(){
				this.attr('map.parts').push({
					type : 'subtitle',
					content : ""
				});
			},
			removePart : function(ctx){
				var parts = this.attr('map.parts'),
					index = parts.indexOf(ctx);

				if(confirm('Are you sure?')){
					parts.splice(index, 1);
				}
			}
		},
		helpers : {
			renderFormPart : function(part, opts){
				var template, type;

				part = can.isFunction(part) ? part() : part;
				type = part.attr('type');

				template = '<article-'+type+' path="parts.{{@index}}" map="{contentPart}"></article-'+type+'>';

				return can.stache(template)(opts.scope.add({
					contentPart : part
				}));
			}
		},
		events : {
			" inserted" : function(){
				this.element.find('.parts').sortable({
					items: "> .panel"
				});
			},
			".parts sortstop" : function(el, ev, data){
				var map = data.item.find('.panel-body > *').scope().attr('map'),
					parts = this.scope.attr('map.parts'),
					index = parts.indexOf(map)
					newIndex = el.find('.panel').index(data.item);

				can.batch.start();

				parts.splice(index, 1);
				parts.splice(newIndex, 0, map);

				can.batch.stop();
				
			}
		}
	});

	

});