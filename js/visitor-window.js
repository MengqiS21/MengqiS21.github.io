(function () {
  var panel = document.querySelector(".visitor-panel[data-visitor-source]");
  if (!panel) {
    return;
  }

  var source = panel.getAttribute("data-visitor-source");
  if (!source) {
    return;
  }

  var world = panel.querySelector(".visitor-panel__world");
  var status = panel.querySelector(".visitor-panel__status");
  var counts = panel.querySelector(".visitor-panel__counts");
  var pixels = Array.prototype.slice.call(panel.querySelectorAll(".pixel"));
  var pings = {
    one: panel.querySelector(".ping--one"),
    two: panel.querySelector(".ping--two"),
    three: panel.querySelector(".ping--three")
  };

  var bucketPixels = {
    northAmerica: ["pixel-a1", "pixel-a2", "pixel-a3", "pixel-b1", "pixel-b2", "pixel-b3"],
    southAmerica: ["pixel-a4", "pixel-b2", "pixel-d1", "pixel-d2"],
    europe: ["pixel-c1", "pixel-c2", "pixel-c3", "pixel-d2", "pixel-d3"],
    africa: ["pixel-c3", "pixel-c4", "pixel-d1", "pixel-d2", "pixel-d3"],
    middleEast: ["pixel-c4", "pixel-c5", "pixel-d3"],
    southAsia: ["pixel-c5", "pixel-d3", "pixel-d4"],
    eastAsia: ["pixel-a5", "pixel-b4", "pixel-b5", "pixel-d4"],
    southeastAsia: ["pixel-c5", "pixel-d4", "pixel-d5"],
    oceania: ["pixel-d5"]
  };

  var bucketAnchors = {
    northAmerica: { left: "11%", top: "31%" },
    southAmerica: { left: "22%", top: "64%" },
    europe: { left: "44%", top: "33%" },
    africa: { left: "47%", top: "60%" },
    middleEast: { left: "58%", top: "48%" },
    southAsia: { left: "68%", top: "58%" },
    eastAsia: { left: "79%", top: "34%" },
    southeastAsia: { left: "76%", top: "62%" },
    oceania: { left: "86%", top: "72%" }
  };

  function resetVisuals() {
    if (world) {
      world.classList.remove("has-data");
    }

    pixels.forEach(function (pixel) {
      pixel.classList.remove("is-active");
    });

    Object.keys(pings).forEach(function (key) {
      var ping = pings[key];
      if (!ping) {
        return;
      }

      ping.classList.remove("is-live");
      ping.style.left = "";
      ping.style.top = "";
    });
  }

  function activateBuckets(bucketNames) {
    bucketNames.forEach(function (bucketName) {
      var pixelClasses = bucketPixels[bucketName] || [];
      pixelClasses.forEach(function (pixelClass) {
        var pixel = panel.querySelector("." + pixelClass);
        if (pixel) {
          pixel.classList.add("is-active");
        }
      });
    });
  }

  function positionPings(bucketNames) {
    ["one", "two", "three"].forEach(function (slot, index) {
      var bucketName = bucketNames[index];
      var ping = pings[slot];
      if (!ping) {
        return;
      }

      if (!bucketName || !bucketAnchors[bucketName]) {
        ping.classList.remove("is-live");
        return;
      }

      var anchor = bucketAnchors[bucketName];
      ping.style.left = anchor.left;
      ping.style.top = anchor.top;
      ping.classList.add("is-live");
    });
  }

  function updateCopy(data) {
    var totalViews = Number(data.totalViews || 0);
    var countryCount = Number(data.countryCount || 0);
    var topCountries = Array.isArray(data.topCountries) ? data.topCountries : [];
    var topCountryNames = topCountries.slice(0, 2).map(function (country) {
      return country.name;
    }).filter(Boolean);
    var remainder = Math.max(topCountries.length - topCountryNames.length, 0);

    if (status) {
      status.textContent = totalViews > 0 ? totalViews.toLocaleString() + " views" : "visitor data warming up";
    }

    if (counts) {
      if (countryCount > 0) {
        counts.textContent = countryCount + " countries" + (topCountryNames.length ? " · " + topCountryNames.join(", ") : "") + (remainder ? " +" + remainder : "");
      } else if (totalViews > 0) {
        counts.textContent = totalViews.toLocaleString() + " total visits";
      } else {
        counts.textContent = "first world log soon";
      }
    }
  }

  fetch(source, { cache: "no-store" })
    .then(function (response) {
      if (!response.ok) {
        throw new Error("Failed to load visitor data");
      }

      return response.json();
    })
    .then(function (data) {
      resetVisuals();
      updateCopy(data);

      var activeBuckets = Array.isArray(data.activeBuckets) ? data.activeBuckets : [];
      activateBuckets(activeBuckets);
      positionPings(Array.isArray(data.topBuckets) ? data.topBuckets : activeBuckets);

      if (world && activeBuckets.length) {
        world.classList.add("has-data");
      }
    })
    .catch(function () {
      resetVisuals();
    });
})();
