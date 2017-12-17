/* eslint no-console: 0 */
// Run this example by adding <%= javascript_pack_tag 'hello_vue' %> (and
// <%= stylesheet_pack_tag 'hello_vue' %> if you have styles in your component)
// to the head of your layout file,
// like app/views/layouts/application.html.erb.
// All it does is render <div>Hello Vue</div> at the bottom of the page.

// import Vue from 'vue'
// import App from '../app.vue'

// document.addEventListener('DOMContentLoaded', () => {
//   document.body.appendChild(document.createElement('hello'))
//   const app = new Vue({
//     render: h => h(App)
//   }).$mount('hello')

//   console.log(app)
// })


// The above code uses Vue without the compiler, which means you cannot
// use Vue to target elements in your existing html templates. You would
// need to always use single file components.
// To be able to target elements in your existing html/erb templates,
// comment out the above code and uncomment the below
// Add <%= javascript_pack_tag 'hello_vue' %> to your layout
// Then add this markup to your html template:
//
// <div id='hello'>
//   {{message}}
//   <app></app>
// </div>


import Vue from 'vue/dist/vue.esm'
import Vuetify from 'vuetify'
// import * as VueGoogleMaps from 'vue2-google-maps'
import SocialSharing from 'vue-social-sharing'
import App from '../app.vue'
// import * as InmoMap from '../inmo-map'
var VueGoogleMaps = require('vue2-google-maps');
var InmoMap = require('../inmo-map');

Vue.use(SocialSharing);
// Vue.use(InmoMap);
Vue.use(Vuetify, {
  theme: PWSAPP.theme
});
Vue.use(VueGoogleMaps, {
  load: {
    key: 'AIzaSyCPorm8YzIaUGhKfe5cvpgofZ_gdT8hdZw'
    // v: '3.26', // Google Maps API version
    // libraries: 'places',   // If you want to use places input
  }
});


document.addEventListener('DOMContentLoaded', () => {


  const app = new Vue({
    el: '#main-vue',
    data: PWSAPP.vueData
  })

})




//
//
//
// If the using turbolinks, install 'vue-turbolinks':
//
// yarn add 'vue-turbolinks'
//
// Then uncomment the code block below:
//
// import TurbolinksAdapter from 'vue-turbolinks';
// import Vue from 'vue/dist/vue.esm'
// import App from '../app.vue'
//
// Vue.use(TurbolinksAdapter)
//
// document.addEventListener('turbolinks:load', () => {
//   const app = new Vue({
//     el: '#hello',
//     data: {
//       message: "Can you say hello?"
//     },
//     components: { App }
//   })
// })