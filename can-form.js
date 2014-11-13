steal('lib/form_component.js', 'can/view/stache', function(FormComponent, stache){
	// Create the simplest implementation of the FormComponent, useful for the ad-hoc forms
	FormComponent({
		tag:'form-for',
		template : stache('<content></content>')
	});

	return FormComponent;
})