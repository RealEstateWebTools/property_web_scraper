// This file is a workaround to allow me to work with webpacker in a rails engine
// When developing with "spec/dummy" app I set Rails.configuration.x.is_spec_dummy_dev to true
// This config value is checked in my layout.  If true javascript_pack_tag declaration
// is used to work with webpack as per normal.
// When this config value is not equal to true (eg when this engine is being used in an app)
// I require this current file using the javascript_include_tag declaration.
// The compiled webpacker assets need to be copied to the vendors directory and the filename below
// updated each time there is a new build.
//= require spp_vuetify-07045936a15995933a2d
