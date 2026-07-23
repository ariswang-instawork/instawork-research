(function () {
  "use strict";

  var STORAGE_KEYS = {
    city: "iw_research_city",
    sessionRedirect: "iw_research_session_redirect",
    demoUser: "iw_research_demo_user",
  };

  var CITIES = [
    { key: "chicago", label: "Chicago, IL", lat: 41.8781, lng: -87.6298 },
    { key: "san-diego", label: "San Diego, CA", lat: 32.7157, lng: -117.1611 },
    { key: "santa-clara", label: "Santa Clara, CA", lat: 37.3541, lng: -121.9552 },
    { key: "boston", label: "Boston, MA", lat: 42.3601, lng: -71.0589 },
    { key: "nyc", label: "New York, NY", lat: 40.7128, lng: -74.006 },
    { key: "philly", label: "Philadelphia, PA", lat: 39.9526, lng: -75.1652 },
  ];

  var SESSIONS = [
    {
      id: "sg-1001",
      cityKey: "san-diego",
      dateISO: "2026-07-28",
      dateLabel: "Mon, Jul 28",
      startTime: "9:00 AM",
      endTime: "12:00 PM",
      hourlyRate: 22.0,
      hours: 3,
      address: "1234 Research Way, San Diego, CA 92101",
      lat: 32.7157,
      lng: -117.1611,
      bookUrl: "https://www.instawork.com/worker",
    },
    {
      id: "sg-1002",
      cityKey: "san-diego",
      dateISO: "2026-07-30",
      dateLabel: "Wed, Jul 30",
      startTime: "1:00 PM",
      endTime: "4:00 PM",
      hourlyRate: 24.5,
      hours: 3,
      address: "1234 Research Way, San Diego, CA 92101",
      lat: 32.7157,
      lng: -117.1611,
      bookUrl: "https://www.instawork.com/worker",
    },
    {
      id: "sg-1003",
      cityKey: "boston",
      dateISO: "2026-07-29",
      dateLabel: "Tue, Jul 29",
      startTime: "10:00 AM",
      endTime: "1:00 PM",
      hourlyRate: 25.0,
      hours: 3,
      address: "88 Harbor St, Boston, MA 02110",
      lat: 42.3601,
      lng: -71.0589,
      bookUrl: "https://www.instawork.com/worker",
    },
    {
      id: "sg-1004",
      cityKey: "nyc",
      dateISO: "2026-07-31",
      dateLabel: "Thu, Jul 31",
      startTime: "5:30 PM",
      endTime: "8:30 PM",
      hourlyRate: 37.0,
      hours: 3,
      address: "200 Market Ave, New York, NY 10001",
      lat: 40.7128,
      lng: -74.006,
      bookUrl: "https://www.instawork.com/worker",
    },
    {
      id: "sg-1005",
      cityKey: "philly",
      dateISO: "2026-08-01",
      dateLabel: "Fri, Aug 1",
      startTime: "8:30 AM",
      endTime: "11:30 AM",
      hourlyRate: 23.0,
      hours: 3,
      address: "450 Liberty Blvd, Philadelphia, PA 19103",
      lat: 39.9526,
      lng: -75.1652,
      bookUrl: "https://www.instawork.com/worker",
    },
    {
      id: "sg-1006",
      cityKey: "santa-clara",
      dateISO: "2026-08-02",
      dateLabel: "Sat, Aug 2",
      startTime: "11:00 AM",
      endTime: "2:00 PM",
      hourlyRate: 26.0,
      hours: 3,
      address: "900 Innovation Dr, Santa Clara, CA 95054",
      lat: 37.3541,
      lng: -121.9552,
      bookUrl: "https://www.instawork.com/worker",
    },
  ];

  function formatCurrency(amount) {
    return "$" + amount.toFixed(2);
  }

  function getEstimatedPay(session) {
    return session.hourlyRate * session.hours;
  }

  function getQueryParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  function findCityByQuery(query) {
    if (!query) {
      return null;
    }
    var normalized = query.trim().toLowerCase();
    for (var i = 0; i < CITIES.length; i += 1) {
      if (CITIES[i].label.toLowerCase().indexOf(normalized) !== -1) {
        return CITIES[i];
      }
    }
    return null;
  }

  function getSelectedCity() {
    var stored = localStorage.getItem(STORAGE_KEYS.city);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (err) {
        return CITIES[0];
      }
    }
    return CITIES[0];
  }

  function setSelectedCity(city) {
    localStorage.setItem(STORAGE_KEYS.city, JSON.stringify(city));
  }

  function getSessionById(id) {
    for (var i = 0; i < SESSIONS.length; i += 1) {
      if (SESSIONS[i].id === id) {
        return SESSIONS[i];
      }
    }
    return null;
  }

  function getSessionsForCity(cityKey) {
    return SESSIONS.filter(function (session) {
      return session.cityKey === cityKey;
    }).sort(function (a, b) {
      return a.dateISO.localeCompare(b.dateISO);
    });
  }

  function saveSessionRedirect(sessionId) {
    if (sessionId) {
      localStorage.setItem(STORAGE_KEYS.sessionRedirect, sessionId);
    }
  }

  function consumeSessionRedirect() {
    var sessionId = getQueryParam("session") || localStorage.getItem(STORAGE_KEYS.sessionRedirect);
    localStorage.removeItem(STORAGE_KEYS.sessionRedirect);
    return sessionId;
  }

  function buildAuthUrl(basePath, sessionId) {
    var url = basePath;
    if (sessionId) {
      url += "?session=" + encodeURIComponent(sessionId);
    }
    return url;
  }

  function goToSessions(locationQuery) {
    var params = new URLSearchParams();
    if (locationQuery) {
      params.set("location", locationQuery);
    }
    var suffix = params.toString();
    window.location.href = "sessions.html" + (suffix ? "?" + suffix : "");
  }

  function setMenuOpen(isOpen) {
    var menuButton = document.getElementById("menuButton");
    var mobileMenu = document.getElementById("mobileMenu");
    if (!menuButton || !mobileMenu) {
      return;
    }
    menuButton.setAttribute("aria-expanded", isOpen ? "true" : "false");
    menuButton.setAttribute("aria-label", isOpen ? "Close menu" : "Open menu");
    mobileMenu.hidden = !isOpen;
    document.body.classList.toggle("menu-open", isOpen);
  }

  function initMobileMenu() {
    var menuButton = document.getElementById("menuButton");
    var mobileMenu = document.getElementById("mobileMenu");
    if (!menuButton || !mobileMenu) {
      return;
    }

    menuButton.addEventListener("click", function () {
      var isOpen = menuButton.getAttribute("aria-expanded") === "true";
      setMenuOpen(!isOpen);
    });

    mobileMenu.addEventListener("click", function (event) {
      if (event.target.closest("a")) {
        setMenuOpen(false);
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    });
  }

  function initCityDialog() {
    var openButtons = document.querySelectorAll("[data-open-city-dialog]");
    var dialog = document.getElementById("cityDialog");
    var optionsRoot = document.getElementById("city-options");
    var cityDialogInput = document.getElementById("cityDialogInput");
    var saveCityButton = document.getElementById("saveCityButton");
    if (!dialog || !optionsRoot) {
      return;
    }

    function applyCity(city) {
      setSelectedCity(city);
      updateLocationLabels();
      var locationInput = document.getElementById("locationInput");
      if (locationInput) {
        locationInput.value = city.label;
      }
      if (typeof window.renderSessionsList === "function") {
        window.renderSessionsList();
      }
    }

    function renderOptions() {
      var selected = getSelectedCity();
      optionsRoot.innerHTML = "";
      CITIES.forEach(function (city) {
        var button = document.createElement("button");
        button.type = "button";
        button.className = "city-option" + (city.key === selected.key ? " is-selected" : "");
        button.textContent = city.label;
        button.addEventListener("click", function () {
          applyCity(city);
          dialog.close();
        });
        optionsRoot.appendChild(button);
      });
    }

    function openDialog() {
      var selected = getSelectedCity();
      renderOptions();
      if (cityDialogInput) {
        cityDialogInput.value = selected.label;
      }
      if (typeof dialog.showModal === "function") {
        dialog.showModal();
        if (cityDialogInput) {
          cityDialogInput.focus();
        }
      }
    }

    openButtons.forEach(function (button) {
      button.addEventListener("click", openDialog);
    });

    if (saveCityButton) {
      saveCityButton.addEventListener("click", function () {
        var query = cityDialogInput ? cityDialogInput.value.trim() : "";
        var match = findCityByQuery(query);
        if (match) {
          applyCity(match);
          dialog.close();
          return;
        }
        alert("Try San Diego, Boston, New York, Philadelphia, Santa Clara, or Chicago.");
      });
    }
  }

  function updateLocationLabels() {
    var city = getSelectedCity();
    document.querySelectorAll("[data-location-label]").forEach(function (node) {
      node.textContent = city.label;
    });
    var selectedLocation = document.getElementById("selectedLocation");
    if (selectedLocation) {
      selectedLocation.textContent = city.label;
    }
    document.querySelectorAll("[data-location-subtitle]").forEach(function (node) {
      node.textContent = "Showing nearby voice recording sessions";
    });
  }

  function initLocationFromQuery() {
    var locationParam = getQueryParam("location");
    if (!locationParam) {
      return;
    }
    var match = findCityByQuery(locationParam);
    if (match) {
      setSelectedCity(match);
    }
  }

  function initSessionSearch() {
    var form = document.getElementById("sessionSearchForm");
    var browseButton = document.getElementById("browseSessionsButton");
    var locationInput = document.getElementById("locationInput");

    if (browseButton) {
      browseButton.addEventListener("click", function () {
        var location = locationInput && locationInput.value ? locationInput.value.trim() : "";
        var match = findCityByQuery(location);
        if (match) {
          setSelectedCity(match);
        }
        goToSessions(location || getSelectedCity().label);
      });
    }

    if (!form) {
      return;
    }

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var location = locationInput && locationInput.value ? locationInput.value.trim() : "";
      if (!location) {
        if (locationInput) {
          locationInput.focus();
        }
        goToSessions(getSelectedCity().label);
        return;
      }
      var match = findCityByQuery(location);
      if (match) {
        setSelectedCity(match);
        goToSessions(match.label);
        return;
      }
      alert("Try San Diego, Boston, New York, Philadelphia, Santa Clara, or Chicago.");
    });
  }

  function renderSessionsList() {
    var root = document.getElementById("session-list");
    if (!root) {
      return;
    }

    var city = getSelectedCity();
    var sessions = getSessionsForCity(city.key);
    root.innerHTML = "";

    if (!sessions.length) {
      root.innerHTML =
        '<div class="empty-state form-card">' +
        "<p>No open sessions in " + city.label + " right now.</p>" +
        "<p>Try another city using Change location.</p>" +
        "</div>";
      return;
    }

    sessions.forEach(function (session) {
      var pay = getEstimatedPay(session);
      var link = document.createElement("a");
      link.className = "session-card";
      link.href = "session.html?id=" + encodeURIComponent(session.id);
      link.innerHTML =
        '<div class="session-card-main">' +
        '<div class="session-card-date">' + session.dateLabel + "</div>" +
        '<div class="session-card-time">' + session.startTime + " – " + session.endTime + "</div>" +
        '<div class="session-card-pay">Estimated pay ' + formatCurrency(pay) + "</div>" +
        "</div>" +
        '<span class="session-card-arrow" aria-hidden="true">›</span>';
      root.appendChild(link);
    });
  }

  function renderSessionDetail() {
    var root = document.getElementById("session-detail");
    if (!root) {
      return;
    }

    var sessionId = getQueryParam("id");
    var session = sessionId ? getSessionById(sessionId) : null;

    if (!session) {
      root.innerHTML =
        '<div class="empty-state form-card">' +
        "<p>Session not found.</p>" +
        '<a class="primary-button" href="sessions.html">Back to sessions</a>' +
        "</div>";
      return;
    }

    var pay = getEstimatedPay(session);
    var directionsUrl =
      "https://www.google.com/maps/dir/?api=1&destination=" +
      encodeURIComponent(session.lat + "," + session.lng);

    root.innerHTML =
      '<section class="detail-hero">' +
      "<p class=\"pay-amount\">Estimated pay " + formatCurrency(pay) + "</p>" +
      "<p class=\"pay-breakdown\">" +
      formatCurrency(session.hourlyRate) +
      " × " +
      session.hours.toFixed(2) +
      " hours</p>" +
      '<div class="detail-meta">' +
      '<div class="detail-meta-item">' +
      '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M8 2v3M16 2v3M3 9h18M5 5h14a2 2 0 012 2v13a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' +
      "<div><strong>" + session.dateLabel + "</strong><br>" + session.startTime + " – " + session.endTime + "</div>" +
      "</div>" +
      '<div class="detail-meta-item">' +
      '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 21s7-4.35 7-10a7 7 0 10-14 0c0 5.65 7 10 7 10z" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="11" r="2.5" stroke="currentColor" stroke-width="2"/></svg>' +
      "<div>" + session.address + '<br><a href="' + directionsUrl + '" target="_blank" rel="noopener noreferrer">Get directions</a></div>' +
      "</div>" +
      "</div>" +
      "</section>" +
      '<section class="section form-card"><h2>What you’ll do</h2><p>Visit the location and complete simple voice recording tasks that help improve AI technology. A staff member will guide you through each step.</p></section>' +
      '<section class="section form-card"><h2>Payment information</h2><p>Estimated pay is ' + formatCurrency(pay) + ' for this session. Payment is processed through Instawork after you complete the shift.</p></section>' +
      '<section class="section form-card"><h2>Important requirements</h2><ul><li>Arrive 10 minutes early with a valid photo ID</li><li>Speak clearly in a quiet room during recordings</li><li>Wear comfortable clothing and follow on-site instructions</li></ul></section>' +
      '<section class="section form-card"><h2>Booking steps</h2><ol><li>Tap Book in the Instawork app below</li><li>Confirm your profile details</li><li>Accept the shift and receive confirmation</li></ol></section>';

    var bookBtn = document.getElementById("book-session-btn");
    if (bookBtn) {
      bookBtn.href = session.bookUrl;
    }

    document.querySelectorAll("[data-auth-link]").forEach(function (link) {
      link.href = buildAuthUrl(link.getAttribute("data-auth-link"), session.id);
    });
  }

  function initAuthForms() {
    var loginForm = document.getElementById("login-form");
    var signupForm = document.getElementById("signup-form");
    var sessionId = getQueryParam("session");

    if (loginForm) {
      loginForm.addEventListener("submit", function (event) {
        event.preventDefault();
        localStorage.setItem(
          STORAGE_KEYS.demoUser,
          JSON.stringify({ email: loginForm.email.value.trim() })
        );
        var redirectId = consumeSessionRedirect() || sessionId;
        window.location.href = redirectId
          ? "session.html?id=" + encodeURIComponent(redirectId)
          : "sessions.html";
      });
    }

    if (signupForm) {
      signupForm.addEventListener("submit", function (event) {
        event.preventDefault();
        localStorage.setItem(
          STORAGE_KEYS.demoUser,
          JSON.stringify({
            name: signupForm.name.value.trim(),
            email: signupForm.email.value.trim(),
          })
        );
        var redirectId = consumeSessionRedirect() || sessionId;
        window.location.href = redirectId
          ? "session.html?id=" + encodeURIComponent(redirectId)
          : "sessions.html";
      });
    }

    var signupLink = document.getElementById("signup-link");
    var loginLink = document.getElementById("login-link");
    if (signupLink && sessionId) {
      signupLink.href = buildAuthUrl("signup.html", sessionId);
    }
    if (loginLink && sessionId) {
      loginLink.href = buildAuthUrl("login.html", sessionId);
    }
  }

  function initSessionPreservation() {
    document.querySelectorAll("[data-preserve-session]").forEach(function (link) {
      link.addEventListener("click", function () {
        var sessionId = getQueryParam("id");
        if (sessionId) {
          saveSessionRedirect(sessionId);
        }
      });
    });
  }

  window.InstaworkResearch = {
    formatCurrency: formatCurrency,
    getSelectedCity: getSelectedCity,
    getSessionsForCity: getSessionsForCity,
    getSessionById: getSessionById,
    saveSessionRedirect: saveSessionRedirect,
    buildAuthUrl: buildAuthUrl,
    CITIES: CITIES,
  };

  window.renderSessionsList = renderSessionsList;

  document.addEventListener("DOMContentLoaded", function () {
    initLocationFromQuery();
    initMobileMenu();
    initCityDialog();
    initSessionSearch();
    initAuthForms();
    initSessionPreservation();
    updateLocationLabels();
    renderSessionsList();
    renderSessionDetail();
  });
})();
