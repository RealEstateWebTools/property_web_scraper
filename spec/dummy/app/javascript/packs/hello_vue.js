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
// import * as VueGoogleMaps from 'vue2-google-maps'
import SocialSharing from 'vue-social-sharing'
import App from '../app.vue'
var VueGoogleMaps = require('vue2-google-maps');
// var SocialSharing = require('vue-social-sharing');
Vue.use(SocialSharing);




Vue.component('inmo-map', {
  template: '<gmap-map style="min-height: 600px;"' +
    ':zoom="15" :center="center" ref="mmm">' +
    '<gmap-info-window ref="infwin" :options="infoOptions" :position="infoWindowPos"' +
    ':opened="infoWinOpen" @closeclick="infoWinOpen=false">' +
    '</gmap-info-window>' +
    '<gmap-marker  v-for="(m,i) in mapkers"  :key="m.id" :position="m.position" ' +
    '@mouseover="toggleInfoWindow(m,i)" @mouseout="statusText = null"' +
    ':clickable="true" :draggable="true" @click=""></gmap-marker>' +
    '</gmap-map>',
  data: function() {
    return {
      newMarkers: [],
      useNewMarkers: false,
      infoContent: '',
      statusText: '',
      infoWindowPos: {
        lat: 0,
        lng: 0
      },
      infoWinOpen: false,
      currentMidx: null,
      //optional: offset infowindow so it visually sits nicely on top of our marker
      infoOptions: {
        content: "hey",
        pixelOffset: {
          width: 0,
          height: -35
        }
      }
    };
  },
  // created() {
  // },
  mounted: function() {
    var that = this;
    this.$refs.mmm.$mapCreated.then(function() {
      if (that.mapkers.length > 1) {
        var bounds = new google.maps.LatLngBounds();
        that.mapkers.forEach(function(mapker){
          bounds.extend(mapker.position);
        });
        // for (let m of that.mapkers) {
        //   bounds.extend(m.position)
        // }
        that.$refs.mmm.$mapObject.fitBounds(bounds);
        // where markers are too close together, I need below
        // to ensure they are not too zoomed in
        that.$refs.mmm.$mapObject.setOptions({ maxZoom: that.$refs.mmm.$mapObject.getZoom() });
      }
    })
  },
  methods: {
    resetMarkers: function(newMarkers) {
      this.newMarkers = newMarkers;
      this.useNewMarkers = true;
    },
    toggleInfoWindow: function(marker, idx) {
      this.infoWindowPos = marker.position;
      var display_price_html = "";
      if (marker.display_price) {
        display_price_html = '<div class="iw-subTitle">' + marker.display_price + '</div>';
      }
      var image_html = "";
      if (marker.image_url) {
        image_html = '<img src="' + marker.image_url + '" alt="" width="225">';
      }

      var infoWindowContent = '<div id="iw-container">' +
        '<a href="' + marker.show_url + '" class="">' +
        '<div class="iw-title">' + marker.title + '</div>' +
        '<div class="iw-content">' +
        display_price_html +
        image_html +
        '</div></a>' +
        '</div>';

      this.infoOptions.content = infoWindowContent;
      //check if its the same marker that was selected if yes toggle
      if (this.currentMidx == idx) {
        this.infoWinOpen = !this.infoWinOpen;
      }
      //if different marker set infowindow to open and reset current marker index
      else {
        this.infoWinOpen = true;
        this.currentMidx = idx;
      }
    }
  },
  // watch: {
  //   mapkers(mapkers) {
  //   }
  // },
  computed: {
    mapkers: function() {
      if (this.useNewMarkers) {
        return this.newMarkers;
      } else {
        return this.markers;
      }
    },
    center: function() {
      var latitude = 0;
      var longitude = 0;
      if (this.markers && (this.markers.length > 0)) {
        latitude = this.markers[0].position.lat;
        longitude = this.markers[0].position.lng;

        // if (this.mapkers.length < 2) {
        // } else {
        //   // const bounds = new google.maps.LatLngBounds()
        //   // for (let m of mapkers) {
        //   //   bounds.extend(m.latLng)
        //   // }
        //   // this.$refs.map.$mapObject.fitBounds(bounds)
        // }
      }
      return { lat: latitude, lng: longitude };
      // `this` points to the vm instance
    }
  },
  props: ['markers'],
});



document.addEventListener('DOMContentLoaded', () => {



  Vue.use(VueGoogleMaps, {
    load: {
      key: 'AIzaSyCPorm8YzIaUGhKfe5cvpgofZ_gdT8hdZw'
      // v: '3.26', // Google Maps API version
      // libraries: 'places',   // If you want to use places input
    }
  });


  const app = new Vue({
    el: '#main-vue',
    data: {
      message: "Can you say hello?"
    }
    // components: { App }
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
