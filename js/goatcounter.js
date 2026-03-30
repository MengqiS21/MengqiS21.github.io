(function () {
  var config = window.SITE_CONFIG || {};
  var baseUrl = typeof config.goatcounterBaseUrl === "string" ? config.goatcounterBaseUrl.trim().replace(/\/$/, "") : "";

  if (!/^https:\/\/[a-z0-9-]+\.goatcounter\.com$/i.test(baseUrl)) {
    return;
  }

  window.goatcounter = window.goatcounter || {};

  var script = document.createElement("script");
  script.async = true;
  script.src = baseUrl + "/count.js";
  script.dataset.goatcounter = baseUrl + "/count";
  document.head.appendChild(script);
})();
