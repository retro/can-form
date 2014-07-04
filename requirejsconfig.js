requirejs.config({
  paths: {
    jquery : 'bower_components/jquery/dist/jquery',
    stache : 'bower_components/require-can-renderers/lib/stache',
    can    : 'bower_components/canjs/amd/can',
    
  },
  packages : [{
    name : 'lodash',
    location : 'bower_components/lodash-amd/modern'
  }]
});