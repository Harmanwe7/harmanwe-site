/* ============================================================
   HARMANWE Living Hero — Scene Engine v1.0
   Dependency-free. Uses browser clock + IANA time zone only.
   No geolocation, no weather API, nothing transmitted.
   
   Reads config from window.HARMANWE_SCENE_CONFIG (hero-config.js).
   Attaches to the first element with [data-hw-hero].
   ============================================================ */
(function () {
  "use strict";

  /* ---- Helpers -------------------------------------------- */
  var cfg = window.HARMANWE_SCENE_CONFIG || {};
  function get(k, d) { return cfg[k] !== undefined ? cfg[k] : d; }
  var qs = (function () {
    var o = {}, s = location.search.substring(1).split("&");
    for (var i = 0; i < s.length; i++) { var p = s[i].split("="); if (p[0]) o[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || ""); }
    return o;
  })();
  var reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var staticMode = get("staticFallbackOnly", false) || qs.hw_static === "1";

  /* ---- Abort conditions ----------------------------------- */
  if (!get("enabled", true)) return;
  var hero = document.querySelector("[data-hw-hero]");
  if (!hero) return;

  /* ---- Sun math (simplified solar position) --------------- */
  var DEG = Math.PI / 180;
  var fallbackLat = get("fallbackLatitude", 36.8);

  function guessLatitude() {
    try {
      var tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
      var map = { "America/Anchorage": 61, "America/Chicago": 41, "America/Denver": 39, "America/Los_Angeles": 34,
        "America/New_York": 40, "America/Phoenix": 33, "Europe/London": 51, "Europe/Paris": 48,
        "Europe/Berlin": 52, "Asia/Tokyo": 35, "Asia/Shanghai": 31, "Australia/Sydney": -33,
        "Pacific/Auckland": -36, "America/Sao_Paulo": -23, "Africa/Johannesburg": -26,
        "Asia/Kolkata": 28, "Asia/Dubai": 25 };
      for (var k in map) if (tz.indexOf(k.split("/")[1]) !== -1) return map[k];
    } catch (e) {}
    return fallbackLat;
  }

  function sunTimes(date, lat) {
    var n = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 86400000);
    var lnoon = 12 - (date.getTimezoneOffset() / 60);
    var decl = -23.44 * Math.cos(2 * Math.PI * (n + 10) / 365);
    var ha = Math.acos((-0.0145 - Math.sin(lat * DEG) * Math.sin(decl * DEG)) /
      (Math.cos(lat * DEG) * Math.cos(decl * DEG)));
    if (isNaN(ha)) ha = lat > 0 ? (decl > 0 ? Math.PI : 0) : (decl < 0 ? Math.PI : 0);
    var haH = ha / DEG / 15;
    return { rise: lnoon - haH, set: lnoon + haH };
  }

  /* ---- Season detection ----------------------------------- */
  function getSeason(date, lat) {
    var m = date.getMonth();
    var south = lat < 0;
    var s;
    if (m >= 2 && m <= 4)       s = south ? "autumn" : "spring";
    else if (m >= 5 && m <= 7)  s = south ? "winter" : "summer";
    else if (m >= 8 && m <= 10) s = south ? "spring" : "autumn";
    else                        s = south ? "summer" : "winter";
    if (qs.hw_season) s = qs.hw_season;
    return s;
  }

  /* ---- Weather state -------------------------------------- */
  function getWeather(season) {
    if (qs.hw_weather) return qs.hw_weather;
    if (!get("weather", {}).enabled) return "clear";
    var allow = (get("weather", {}).allow) || {};
    var weights = {
      clear: 40, partlyCloudy: 25, overcast: 10,
      rain: season === "spring" ? 15 : season === "summer" ? 8 : 10,
      mist: season === "autumn" ? 12 : 5,
      snow: (season === "winter") ? 12 : 0,
      postRain: season === "spring" ? 10 : 5
    };
    var pool = []; var total = 0;
    for (var w in weights) {
      if (allow[w] !== false && weights[w] > 0) { pool.push({ w: w, v: weights[w] }); total += weights[w]; }
    }
    // Session persistence
    var persistH = (get("weather", {}).persistHours) || 3;
    try {
      var stored = JSON.parse(localStorage.getItem("hw_weather") || "null");
      if (stored && stored.w && (Date.now() - stored.t) < persistH * 3600000) return stored.w;
    } catch (e) {}
    var r = Math.random() * total, acc = 0, picked = "clear";
    for (var i = 0; i < pool.length; i++) { acc += pool[i].v; if (r <= acc) { picked = pool[i].w; break; } }
    try { localStorage.setItem("hw_weather", JSON.stringify({ w: picked, t: Date.now() })); } catch (e) {}
    return picked;
  }

  /* ---- Phase definitions (11 phases) ---------------------- */
  /*  0 deepNight    1 lateNight    2 preDawn      3 dawn
      4 goldenMorn   5 morning      6 midday       7 afternoon
      8 goldenEve    9 dusk        10 evening                  */
  var PHASES = [
    { name: "deepNight",  bri: 0.35, sat: 0.3,  con: 1.1, sep: 0.05, hue: 220, skyO: 0.5,  sky: "linear-gradient(to bottom, #0a0e1a, #141e2e)", warmO: 0,    coolO: 0.6, glowWin: 0.9,  glowPorch: 0.8,  glowLand: 0.6,  scrim: 0.5,  mist: 0 },
    { name: "lateNight",  bri: 0.38, sat: 0.35, con: 1.1, sep: 0.04, hue: 215, skyO: 0.45, sky: "linear-gradient(to bottom, #0e1525, #1a2538)", warmO: 0,    coolO: 0.5, glowWin: 0.85, glowPorch: 0.75, glowLand: 0.55, scrim: 0.48, mist: 0 },
    { name: "preDawn",    bri: 0.45, sat: 0.4,  con: 1.05,sep: 0.03, hue: 200, skyO: 0.35, sky: "linear-gradient(to bottom, #1a2035, #2a3550)", warmO: 0.05, coolO: 0.35,glowWin: 0.7,  glowPorch: 0.6,  glowLand: 0.4,  scrim: 0.42, mist: 0.15 },
    { name: "dawn",       bri: 0.6,  sat: 0.6,  con: 1.0, sep: 0.08, hue: 15,  skyO: 0.3,  sky: "linear-gradient(to bottom, #3a2545, #d4845a)", warmO: 0.15, coolO: 0.1, glowWin: 0.4,  glowPorch: 0.3,  glowLand: 0.2,  scrim: 0.35, mist: 0.25 },
    { name: "goldenMorn", bri: 0.85, sat: 0.85, con: 1.0, sep: 0.1,  hue: 10,  skyO: 0.2,  sky: "linear-gradient(to bottom, #6a4530, #f0a860)", warmO: 0.2,  coolO: 0,   glowWin: 0.15, glowPorch: 0.05, glowLand: 0.05, scrim: 0.3,  mist: 0.1 },
    { name: "morning",    bri: 1.0,  sat: 0.95, con: 1.0, sep: 0.02, hue: 0,   skyO: 0.1,  sky: "linear-gradient(to bottom, #5588cc, #a0c4e8)", warmO: 0.05, coolO: 0,   glowWin: 0,    glowPorch: 0,    glowLand: 0,    scrim: 0.25, mist: 0 },
    { name: "midday",     bri: 1.1,  sat: 1.0,  con: 1.05,sep: 0,    hue: 0,   skyO: 0.08, sky: "linear-gradient(to bottom, #4a80c0, #90b8e0)", warmO: 0,    coolO: 0,   glowWin: 0,    glowPorch: 0,    glowLand: 0,    scrim: 0.2,  mist: 0 },
    { name: "afternoon",  bri: 1.05, sat: 1.0,  con: 1.0, sep: 0.02, hue: 5,   skyO: 0.1,  sky: "linear-gradient(to bottom, #5a90cc, #c0d0e0)", warmO: 0.08, coolO: 0,   glowWin: 0,    glowPorch: 0,    glowLand: 0,    scrim: 0.25, mist: 0 },
    { name: "goldenEve",  bri: 0.95, sat: 0.9,  con: 1.0, sep: 0.12, hue: 15,  skyO: 0.2,  sky: "linear-gradient(to bottom, #c07040, #f0b060)", warmO: 0.2,  coolO: 0,   glowWin: 0.1,  glowPorch: 0.1,  glowLand: 0.05, scrim: 0.3,  mist: 0 },
    { name: "dusk",       bri: 0.75, sat: 0.7,  con: 1.0, sep: 0.1,  hue: 20,  skyO: 0.3,  sky: "linear-gradient(to bottom, #3a2040, #c06848)", warmO: 0.15, coolO: 0.1, glowWin: 0.6,  glowPorch: 0.5,  glowLand: 0.35, scrim: 0.38, mist: 0.05 },
    { name: "evening",    bri: 0.5,  sat: 0.45, con: 1.05,sep: 0.05, hue: 225, skyO: 0.45, sky: "linear-gradient(to bottom, #121828, #1e2840)", warmO: 0,    coolO: 0.45,glowWin: 0.85, glowPorch: 0.7,  glowLand: 0.5,  scrim: 0.45, mist: 0 }
  ];

  function timeToPhaseBlend(t, sun) {
    /* t = fractional hour (0–24). Returns { a: index, b: index, blend: 0–1 } */
    var rise = sun.rise, set = sun.set;
    var anchors = [
      { phase: 0, t: 1 },        // deepNight
      { phase: 1, t: rise - 2 }, // lateNight
      { phase: 2, t: rise - 1 }, // preDawn
      { phase: 3, t: rise },     // dawn
      { phase: 4, t: rise + 0.5 },// goldenMorn
      { phase: 5, t: rise + 1.5 },// morning
      { phase: 6, t: 12 },       // midday
      { phase: 7, t: set - 2 },  // afternoon
      { phase: 8, t: set - 0.5 },// goldenEve
      { phase: 9, t: set },      // dusk
      { phase: 10, t: set + 1 }, // evening
      { phase: 0, t: 24 }        // wrap to deepNight
    ];
    // Clamp time
    if (t < 0) t = 0; if (t >= 24) t = 23.999;
    for (var i = 0; i < anchors.length - 1; i++) {
      if (t >= anchors[i].t && t < anchors[i + 1].t) {
        var span = anchors[i + 1].t - anchors[i].t;
        var blend = span > 0 ? (t - anchors[i].t) / span : 0;
        return { a: anchors[i].phase, b: anchors[i + 1].phase, blend: blend };
      }
    }
    return { a: 0, b: 0, blend: 0 };
  }

  function lerp(a, b, t) { return a + (b - a) * t; }

  function interpolatePhase(pb) {
    var A = PHASES[pb.a], B = PHASES[pb.b], t = pb.blend;
    return {
      bri: lerp(A.bri, B.bri, t), sat: lerp(A.sat, B.sat, t),
      con: lerp(A.con, B.con, t), sep: lerp(A.sep, B.sep, t),
      hue: lerp(A.hue, B.hue, t), skyO: lerp(A.skyO, B.skyO, t),
      warmO: lerp(A.warmO, B.warmO, t), coolO: lerp(A.coolO, B.coolO, t),
      glowWin: lerp(A.glowWin, B.glowWin, t),
      glowPorch: lerp(A.glowPorch, B.glowPorch, t),
      glowLand: lerp(A.glowLand, B.glowLand, t),
      scrim: lerp(A.scrim, B.scrim, t), mist: lerp(A.mist, B.mist, t),
      sky: t < 0.5 ? A.sky : B.sky,
      name: t < 0.5 ? A.name : B.name
    };
  }

  /* ---- Weather modifiers ---------------------------------- */
  function applyWeather(vals, weather) {
    switch (weather) {
      case "overcast":
        vals.sat *= 0.65; vals.bri *= 0.9; vals.skyO = Math.min(vals.skyO + 0.15, 0.6);
        vals.cloudO = 0.4; break;
      case "partlyCloudy":
        vals.sat *= 0.85; vals.cloudO = 0.2; break;
      case "rain":
        vals.sat *= 0.55; vals.bri *= 0.8; vals.coolO = Math.min(vals.coolO + 0.15, 0.6);
        vals.cloudO = 0.55; vals.rainOn = true; break;
      case "mist":
        vals.sat *= 0.6; vals.bri *= 0.85; vals.mist = Math.max(vals.mist, 0.35);
        vals.cloudO = 0.2; break;
      case "snow":
        vals.sat *= 0.5; vals.bri *= 1.1; vals.coolO = Math.max(vals.coolO, 0.2);
        vals.cloudO = 0.35; vals.snowOn = true; break;
      case "postRain":
        vals.sat *= 1.1; vals.bri *= 0.95; vals.mist = Math.max(vals.mist, 0.15); break;
      default: // clear
        vals.cloudO = 0; break;
    }
    return vals;
  }

  /* ---- DOM setup ------------------------------------------ */
  var existingImg = hero.querySelector("img");

  // Create layers
  function makeLayer(cls) {
    var d = document.createElement("div");
    d.className = "hw-layer " + cls;
    hero.appendChild(d);
    return d;
  }
  var skyEl = makeLayer("hw-sky");
  var warmEl = makeLayer("hw-warm");
  var coolEl = makeLayer("hw-cool");
  var mistEl = makeLayer("hw-mist");
  var cloudEl = document.createElement("div");
  cloudEl.className = "hw-weather-cloud";
  hero.appendChild(cloudEl);

  // Scrim
  var scrimEl = document.createElement("div");
  scrimEl.className = "hw-scrim";
  hero.appendChild(scrimEl);

  // Light glows
  function makeGlows(arr, cls) {
    if (!arr) return;
    for (var i = 0; i < arr.length; i++) {
      var g = document.createElement("div");
      g.className = "hw-glow " + cls;
      g.style.left = (arr[i].x - arr[i].w) + "%";
      g.style.top = (arr[i].y - arr[i].h) + "%";
      g.style.width = (arr[i].w * 2) + "%";
      g.style.height = (arr[i].h * 2) + "%";
      hero.appendChild(g);
    }
  }
  if (get("interiorLights", true)) makeGlows(get("windowLights", []), "hw-glow--window");
  if (get("exteriorLights", true)) {
    var pl = get("porchLights", null) || (get("porchLight", null) ? [cfg.porchLight] : []);
    makeGlows(pl, "hw-glow--porch");
    makeGlows(get("landscapeLights", []), "hw-glow--landscape");
  }

  // Particle canvas
  var canvas = null, ctx = null;
  if (!reducedMotion && !staticMode) {
    canvas = document.createElement("canvas");
    canvas.className = "hw-particles";
    hero.appendChild(canvas);
    ctx = canvas.getContext("2d");
  }

  // Tag the plate
  if (existingImg) existingImg.classList.add("hw-plate", "hw-plate--under");

  // Wind class
  if (get("windMotion", true) && !reducedMotion && !staticMode) {
    hero.classList.add("hw-wind");
  }

  /* ---- Particle systems ----------------------------------- */
  var particles = [];
  var intensity = get("animationIntensity", 0.8);

  function spawnStars(count) {
    for (var i = 0; i < count; i++) {
      particles.push({
        type: "star", x: Math.random(), y: Math.random() * 0.5,
        size: 1 + Math.random() * 1.5, twinkleSpeed: 0.5 + Math.random() * 2,
        phase: Math.random() * Math.PI * 2
      });
    }
  }

  function spawnFireflies(count) {
    for (var i = 0; i < count; i++) {
      particles.push({
        type: "firefly", x: 0.2 + Math.random() * 0.6, y: 0.55 + Math.random() * 0.3,
        vx: (Math.random() - 0.5) * 0.0003, vy: (Math.random() - 0.5) * 0.0002,
        size: 2 + Math.random() * 2, pulseSpeed: 1 + Math.random() * 2,
        phase: Math.random() * Math.PI * 2
      });
    }
  }

  function spawnRain(count) {
    for (var i = 0; i < count; i++) {
      particles.push({
        type: "rain", x: Math.random(), y: Math.random(),
        speed: 0.008 + Math.random() * 0.006, len: 8 + Math.random() * 12
      });
    }
  }

  function spawnSnow(count) {
    for (var i = 0; i < count; i++) {
      particles.push({
        type: "snow", x: Math.random(), y: Math.random(),
        speed: 0.001 + Math.random() * 0.002, size: 1.5 + Math.random() * 3,
        drift: (Math.random() - 0.5) * 0.001, wobblePhase: Math.random() * Math.PI * 2
      });
    }
  }

  function drawParticles(time, vals) {
    if (!canvas || !ctx) return;
    var w = canvas.width = hero.offsetWidth * (window.devicePixelRatio || 1);
    var h = canvas.height = hero.offsetHeight * (window.devicePixelRatio || 1);
    ctx.clearRect(0, 0, w, h);

    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      if (p.type === "star") {
        var alpha = (0.3 + 0.7 * Math.abs(Math.sin(time * 0.001 * p.twinkleSpeed + p.phase))) * vals.starO;
        if (alpha < 0.02) continue;
        ctx.fillStyle = "rgba(255,255,240," + alpha.toFixed(3) + ")";
        ctx.beginPath();
        ctx.arc(p.x * w, p.y * h, p.size * (window.devicePixelRatio || 1), 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === "firefly") {
        var fa = (0.2 + 0.8 * Math.abs(Math.sin(time * 0.001 * p.pulseSpeed + p.phase))) * vals.fireflyO;
        if (fa < 0.02) continue;
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0.15 || p.x > 0.85) p.vx *= -1;
        if (p.y < 0.5 || p.y > 0.9) p.vy *= -1;
        ctx.fillStyle = "rgba(200,255,100," + fa.toFixed(3) + ")";
        ctx.shadowColor = "rgba(200,255,100," + (fa * 0.5).toFixed(3) + ")";
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(p.x * w, p.y * h, p.size * (window.devicePixelRatio || 1), 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      } else if (p.type === "rain") {
        p.y += p.speed;
        if (p.y > 1) { p.y = -0.05; p.x = Math.random(); }
        ctx.strokeStyle = "rgba(180,200,220,0.3)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p.x * w, p.y * h);
        ctx.lineTo(p.x * w - 2, (p.y * h) + p.len * (window.devicePixelRatio || 1));
        ctx.stroke();
      } else if (p.type === "snow") {
        p.y += p.speed;
        p.x += p.drift + Math.sin(time * 0.001 + p.wobblePhase) * 0.0003;
        if (p.y > 1) { p.y = -0.05; p.x = Math.random(); }
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.beginPath();
        ctx.arc(p.x * w, p.y * h, p.size * (window.devicePixelRatio || 1), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /* ---- Apply scene state to DOM --------------------------- */
  function applyScene(vals) {
    var s = hero.style;
    s.setProperty("--hw-bri", vals.bri.toFixed(3));
    s.setProperty("--hw-sat", vals.sat.toFixed(3));
    s.setProperty("--hw-con", vals.con.toFixed(3));
    s.setProperty("--hw-sep", vals.sep.toFixed(3));
    s.setProperty("--hw-hue", vals.hue.toFixed(1) + "deg");
    s.setProperty("--hw-sky-o", vals.skyO.toFixed(3));
    s.setProperty("--hw-warm-o", vals.warmO.toFixed(3));
    s.setProperty("--hw-cool-o", vals.coolO.toFixed(3));
    s.setProperty("--hw-glow-win", vals.glowWin.toFixed(3));
    s.setProperty("--hw-glow-porch", vals.glowPorch.toFixed(3));
    s.setProperty("--hw-glow-land", vals.glowLand.toFixed(3));
    s.setProperty("--hw-scrim", vals.scrim.toFixed(3));
    s.setProperty("--hw-mist-o", vals.mist.toFixed(3));
    s.setProperty("--hw-mist-show", vals.mist > 0 ? "1" : "0");
    s.setProperty("--hw-cloud-o", (vals.cloudO || 0).toFixed(3));

    skyEl.style.background = vals.sky;
  }

  /* ---- Compute current state ------------------------------ */
  var lat = guessLatitude();
  var adminTime = null; // set by admin panel

  function computeNow() {
    var now = new Date();
    var t;
    if (adminTime !== null) {
      t = adminTime;
    } else if (qs.hw_time) {
      t = parseFloat(qs.hw_time);
    } else if (get("mode", "auto") === "manual") {
      var mp = get("manualPhase", "dusk");
      for (var i = 0; i < PHASES.length; i++) if (PHASES[i].name === mp) return { vals: PHASES[i], weather: "clear", season: "summer" };
      return { vals: PHASES[9], weather: "clear", season: "summer" };
    } else {
      t = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
    }
    var sun = sunTimes(now, lat);
    var season = getSeason(now, lat);
    var weather = getWeather(season);
    var pb = timeToPhaseBlend(t, sun);
    var vals = interpolatePhase(pb);
    vals.cloudO = 0;
    vals.rainOn = false;
    vals.snowOn = false;
    // Particle opacity flags
    vals.starO = (vals.glowWin > 0.3) ? Math.min((vals.glowWin - 0.3) / 0.5, 1) * 0.8 : 0;
    vals.fireflyO = (season === "summer" && vals.name === "evening" || vals.name === "dusk") ? 0.7 : 0;
    vals = applyWeather(vals, weather);
    return { vals: vals, weather: weather, season: season, time: t, sun: sun, phaseName: vals.name };
  }

  /* ---- Init particles ------------------------------------- */
  function initParticles(state) {
    particles = [];
    if (reducedMotion || staticMode || !canvas) return;
    var count = Math.round(intensity * 30);
    if (state.vals.starO > 0.1) spawnStars(count);
    if (state.vals.fireflyO > 0.1 && get("fireflies", true)) spawnFireflies(Math.round(intensity * 8));
    if (state.vals.rainOn && get("rainFx", true)) spawnRain(Math.round(intensity * 80));
    if (state.vals.snowOn && get("snowFx", true)) spawnSnow(Math.round(intensity * 40));
  }

  /* ---- Main loop ------------------------------------------ */
  var lastState = computeNow();
  initParticles(lastState);
  applyScene(lastState.vals);

  if (!staticMode) {
    var lastParticleInit = lastState.weather;
    (function tick(time) {
      var state = computeNow();
      applyScene(state.vals);
      // Re-init particles if weather changed
      if (state.weather !== lastParticleInit) {
        initParticles(state);
        lastParticleInit = state.weather;
      }
      drawParticles(time || 0, state.vals);
      lastState = state;
      requestAnimationFrame(tick);
    })();
    // Full recompute every 60s for time progression
    setInterval(function () { lastState = computeNow(); }, 60000);
  }

  /* ---- Admin panel ---------------------------------------- */
  if (qs.hw_admin === "1") {
    var panel = document.createElement("div");
    panel.className = "hw-admin hw-admin--show";
    panel.innerHTML =
      '<div class="hw-admin-row">' +
        '<label>Time <input type="range" id="hwTimeSlider" min="0" max="24" step="0.05" value="12"> ' +
        '<span class="hw-admin-readout" id="hwTimeRead">12:00</span></label>' +
        '<label>Season <select id="hwSeasonSel"><option value="">auto</option><option>spring</option><option>summer</option><option>autumn</option><option>winter</option></select></label>' +
        '<label>Weather <select id="hwWeatherSel"><option value="">auto</option><option>clear</option><option>partlyCloudy</option><option>overcast</option><option>rain</option><option>mist</option><option>snow</option><option>postRain</option></select></label>' +
        '<button id="hwCopyState">Copy current state URL</button>' +
      '</div>' +
      '<div class="hw-admin-row"><span class="hw-admin-readout" id="hwPhaseRead"></span></div>';
    document.body.appendChild(panel);

    var slider = document.getElementById("hwTimeSlider");
    var timeRead = document.getElementById("hwTimeRead");
    var phaseRead = document.getElementById("hwPhaseRead");
    var seasonSel = document.getElementById("hwSeasonSel");
    var weatherSel = document.getElementById("hwWeatherSel");

    // Set initial
    var initState = computeNow();
    if (initState.time !== undefined) slider.value = initState.time;

    function formatTime(t) {
      var h = Math.floor(t), m = Math.round((t - h) * 60);
      if (m === 60) { h++; m = 0; }
      return (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m;
    }

    function adminUpdate() {
      adminTime = parseFloat(slider.value);
      if (seasonSel.value) qs.hw_season = seasonSel.value; else delete qs.hw_season;
      if (weatherSel.value) qs.hw_weather = weatherSel.value; else delete qs.hw_weather;
      var state = computeNow();
      applyScene(state.vals);
      initParticles(state);
      timeRead.textContent = formatTime(adminTime);
      phaseRead.textContent = "Phase: " + state.vals.name + " | Season: " + state.season + " | Weather: " + state.weather +
        " | Sunrise: " + formatTime(state.sun.rise) + " | Sunset: " + formatTime(state.sun.set);
    }

    slider.addEventListener("input", adminUpdate);
    seasonSel.addEventListener("change", adminUpdate);
    weatherSel.addEventListener("change", adminUpdate);
    adminUpdate();

    document.getElementById("hwCopyState").addEventListener("click", function () {
      var u = location.origin + location.pathname + "?hw_admin=1" +
        (adminTime !== null ? "&hw_time=" + adminTime.toFixed(2) : "") +
        (qs.hw_season ? "&hw_season=" + qs.hw_season : "") +
        (qs.hw_weather ? "&hw_weather=" + qs.hw_weather : "");
      navigator.clipboard && navigator.clipboard.writeText(u);
      this.textContent = "Copied ✓";
      var b = this;
      setTimeout(function () { b.textContent = "Copy current state URL"; }, 1500);
    });
  }
})();
