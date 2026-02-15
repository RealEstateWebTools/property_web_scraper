(function() {
  var application = window.PropertyWebScraperStimulus;
  if (!application) return;

  application.register("carousel", class extends Stimulus.Controller {
    connect() {
      // Bootstrap 5 carousel works via data-bs-* attributes automatically.
      // This controller is a hook for future enhancements (lazy loading, fullscreen, etc.)
    }
  });
})();
