(function() {
  var application = window.PropertyWebScraperStimulus;
  if (!application) return;

  application.register("scraper-form", class extends Stimulus.Controller {
    static get targets() {
      return ["tab", "urlInput", "htmlGroup", "fileGroup", "modeHint", "submitBtn"];
    }

    connect() {
      this._mode = "url";
      var form = this.element.querySelector("form");
      if (form) {
        form.addEventListener("submit", this._handleSubmit.bind(this));
      }
    }

    switchMode(event) {
      event.preventDefault();
      var mode = event.currentTarget.dataset.mode;
      this._mode = mode;

      // Update active tab
      this.tabTargets.forEach(function(tab) {
        if (tab.dataset.mode === mode) {
          tab.classList.add("active");
        } else {
          tab.classList.remove("active");
        }
      });

      // Show/hide extra input groups
      this.htmlGroupTarget.classList.toggle("d-none", mode !== "html");
      this.fileGroupTarget.classList.toggle("d-none", mode !== "file");

      // Update hint text
      var hints = {
        url: "We'll fetch the page directly. Works best with static HTML sites.",
        html: "Paste the full page source. Ideal for JavaScript-rendered sites.",
        file: "Upload a saved .html file from your browser."
      };
      this.modeHintTarget.textContent = hints[mode];

      // Update submit button text
      var labels = {
        url: "Fetch & Extract",
        html: "Extract from HTML",
        file: "Extract from File"
      };
      // submit_tag renders <input type="submit"> which uses .value
      this.submitBtnTarget.value = labels[mode];
    }

    _handleSubmit(event) {
      event.preventDefault();
      var form = event.target;
      var formData = new FormData(form);
      var submitBtn = this.submitBtnTarget;
      var originalLabel = submitBtn.value;

      submitBtn.value = "Extracting\u2026";
      submitBtn.disabled = true;

      var resultsContainer = document.getElementById("retrieve-results");
      resultsContainer.innerHTML =
        '<div class="text-center py-4">' +
          '<div class="spinner-border text-primary" role="status"></div>' +
          '<p class="mt-2 text-muted">Extracting property data\u2026</p>' +
        '</div>';
      resultsContainer.scrollIntoView({ behavior: "smooth", block: "start" });

      fetch(form.action, {
        method: "POST",
        body: formData,
        headers: { "Accept": "text/html" }
      })
      .then(function(response) { return response.text(); })
      .then(function(html) {
        // Response is wrapped in <turbo-frame>, extract inner content
        var parser = new DOMParser();
        var doc = parser.parseFromString(html, "text/html");
        var frame = doc.querySelector("turbo-frame#retrieve-results");
        resultsContainer.innerHTML = frame ? frame.innerHTML : html;
        resultsContainer.scrollIntoView({ behavior: "smooth", block: "start" });
      })
      .catch(function() {
        resultsContainer.innerHTML =
          '<div class="pws-error-card">' +
            '<div class="pws-error-icon"><i class="bi bi-exclamation-triangle"></i></div>' +
            '<h5>Network Error</h5>' +
            '<p>Could not connect to the server. Please try again.</p>' +
          '</div>';
      })
      .finally(function() {
        submitBtn.value = originalLabel;
        submitBtn.disabled = false;
      });
    }
  });
})();
