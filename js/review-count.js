(function() {
  var CACHE_KEY = 'jcd_reviews_v1';
  function updateCounts() {
    try {
      var cached = localStorage.getItem(CACHE_KEY);
      if (!cached) return;
      var data = JSON.parse(cached);
      if (!data.count) return;
      // Update all visible review count spans
      document.querySelectorAll('.jcd-rc').forEach(function(el) {
        el.textContent = data.count;
      });
      // Update schema reviewCount on homepage
      var schema = document.querySelector('script[type="application/ld+json"]');
      if (schema) {
        try {
          var json = JSON.parse(schema.textContent);
          if (json.aggregateRating) {
            json.aggregateRating.reviewCount = String(data.count);
            if (data.rating) json.aggregateRating.ratingValue = String(data.rating);
            schema.textContent = JSON.stringify(json, null, 2);
          }
        } catch(e) {}
      }
    } catch(e) {}
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateCounts);
  } else {
    updateCounts();
  }
})();
