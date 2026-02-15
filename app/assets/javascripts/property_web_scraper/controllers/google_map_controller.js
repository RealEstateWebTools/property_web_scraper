(function() {
  var application = window.PropertyWebScraperStimulus;
  if (!application) return;

  application.register("google-map", class extends Stimulus.Controller {
    static get targets() { return ["container"]; }
    static get values() {
      return {
        markers: { type: String, default: "[]" },
        zoom: { type: Number, default: 15 },
        apiKey: { type: String, default: "" }
      };
    }

    connect() {
      this._loadGoogleMaps().then(function() {
        this._initMap();
      }.bind(this));
    }

    _loadGoogleMaps() {
      var self = this;
      return new Promise(function(resolve) {
        if (window.google && window.google.maps) {
          resolve();
          return;
        }
        var apiKey = self.apiKeyValue;
        if (!apiKey) {
          console.warn("Google Maps API key not provided");
          resolve();
          return;
        }
        var script = document.createElement("script");
        script.src = "https://maps.googleapis.com/maps/api/js?key=" + apiKey;
        script.onload = resolve;
        document.head.appendChild(script);
      });
    }

    _initMap() {
      if (!window.google || !window.google.maps) return;

      var markers = JSON.parse(this.markersValue);
      if (markers.length === 0) return;

      var firstPos = markers[0].position;
      var map = new google.maps.Map(this.containerTarget, {
        zoom: this.zoomValue,
        center: firstPos
      });

      markers.forEach(function(markerData) {
        var marker = new google.maps.Marker({
          position: markerData.position,
          map: map,
          title: markerData.title
        });

        if (markerData.title) {
          var infoWindow = new google.maps.InfoWindow({
            content: "<strong>" + markerData.title + "</strong>"
          });
          marker.addListener("click", function() {
            infoWindow.open(map, marker);
          });
        }
      });
    }
  });
})();
