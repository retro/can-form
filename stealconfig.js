(function () {
	// taking from HTML5 Shiv v3.6.2 | @afarkas @jdalton @jon_neal @rem | MIT/GPL2 Licensed
	var supportsUnknownElements = false;

	(function () {
		try {
			var a = document.createElement('a');
			a.innerHTML = '<xyz></xyz>';

			supportsUnknownElements = a.childNodes.length == 1 || (function () {
				// assign a false positive if unable to shiv
				(document.createElement)('a');
				var frag = document.createDocumentFragment();
				return (
					typeof frag.cloneNode == 'undefined' ||
						typeof frag.createDocumentFragment == 'undefined' ||
						typeof frag.createElement == 'undefined'
					);
			}());
		} catch (e) {
			// assign a false positive if detection fails => unable to shiv
			supportsUnknownElements = true;
		}
	}());


	steal.config({
		map: {
			"can/util/util": "can/util/jquery/jquery",
			"jquery/jquery": "jquery"
		},
		paths: {
			"jquery": "bower_components/jquery/dist/jquery.js",
			"can/*": "bower_components/canjs/*.js",
			"lodash/*": "bower_components/lodash-amd/modern/*.js",
			"ui/*": "bower_components/jqueryui/ui/*.js",
			"bootstrap" : "bower_components/bootstrap/dist/js/bootstrap.js",
			"bootstrap.css" : "bower_components/bootstrap/dist/css/bootstrap.csscss"
		},
		meta: {
			jquery: {
				exports: "jQuery",
				deps: supportsUnknownElements ? undefined : ["can/lib/html5shiv.js"]
			},
			"ui/core": {deps: ["jquery"]},
			"ui/widget": {deps: ["jquery"]},
			"ui/accordion": {deps: ["ui/core","ui/widget"]}
		},
		ext: {
			ejs: "can/view/ejs/system",
			mustache: "can/view/mustache/system",
			stache: "can/view/stache/system"
		}
	});
})();


System.buildConfig = {map: {"can/util/util" : "can/util/domless/domless"}};
