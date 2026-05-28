(function() {
  var CACHE_KEY = 'jcd_reviews_v1';
  var CACHE_TTL = 21600000; // 6 hours in ms

  function updateCounts(count, rating) {
    if (!count) return;
    document.querySelectorAll('.jcd-rc').forEach(function(el) {
      el.textContent = count;
    });
    // Update schema reviewCount on homepage
    var schema = document.querySelector('script[type="application/ld+json"]');
    if (schema) {
      try {
        var json = JSON.parse(schema.textContent);
        if (json.aggregateRating) {
          json.aggregateRating.reviewCount = String(count);
          if (rating) json.aggregateRating.ratingValue = String(rating);
          schema.textContent = JSON.stringify(json, null, 2);
        }
      } catch(e) {}
    }
  }

  function loadFromCache() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data.count) return null;
      return data;
    } catch(e) { return null; }
  }

  function fetchFromGoogle() {
    // Only fetch if the Google Maps Places API is available on this page
    if (typeof google === 'undefined' || !google.maps || !google.maps.places || !google.maps.places.Place) return;
    var place = new google.maps.places.Place({id: 'ChIJrVmyDmZSpY4RA_ZQy0-RkW0'});
    place.fetchFields({fields: ['rating', 'userRatingCount']}).then(function(result) {
      var p = result.place || result;
      if (!p || !p.userRatingCount) return;
      var count = p.userRatingCount;
      var rating = p.rating || 5;
      // Update the cache
      try {
        var existing = loadFromCache() || {};
        existing.count = count;
        existing.rating = rating;
        existing.ts = Date.now();
        localStorage.setItem(CACHE_KEY, JSON.stringify(existing));
      } catch(e) {}
      updateCounts(count, rating);
    }).catch(function() {});
  }

  function init() {
    var cached = loadFromCache();
    var age = cached ? (Date.now() - (cached.ts || 0)) : Infinity;

    // Always show cached value immediately
    if (cached) updateCounts(cached.count, cached.rating);

    // Refetch from Google if cache is older than 6 hours
    if (age > CACHE_TTL) {
      // If Maps is already loaded, fetch now
      if (typeof google !== 'undefined' && google.maps && google.maps.places) {
        fetchFromGoogle();
      } else {
        // Wait for Maps to load, then fetch
        var orig = window.initMap || window.initMapsAndReviews;
        var checkInterval = setInterval(function() {
          if (typeof google !== 'undefined' && google.maps && google.maps.places && google.maps.places.Place) {
            clearInterval(checkInterval);
            fetchFromGoogle();
          }
        }, 1000);
        // Give up after 15 seconds
        setTimeout(function() { clearInterval(checkInterval); }, 15000);
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
