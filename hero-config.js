/* ============================================================
   HARMANWE Living Hero — Administrator Configuration
   Edit this file to control the scene. No other code changes
   are ever needed for day-to-day management.

   NOTE: The master plate is the dusk photograph with interior
   and porch lights already lit. The light-glow coordinates
   below were measured pixel-accurately from that image and
   verified against the actual light sources.
   ============================================================ */
window.HARMANWE_SCENE_CONFIG = {

  /* ---- Master switches ------------------------------------ */
  enabled: true,            // false = plain static hero image (emergency override)
  mode: "auto",             // "auto" (visitor local time) | "manual"
  manualPhase: "dusk",      // used only when mode:"manual"
  staticFallbackOnly: false,// true = graded still, zero animation for everyone

  /* ---- Photographic plates --------------------------------
     Only "master" is required (the live dusk hero). Add dawn/
     day/night plates as they are generated; the engine cross-
     fades automatically and falls back to master + grading
     when a plate is absent. PRIORITY: generate the DAY plate
     first — the master's lit windows are the one detail that
     grading alone cannot switch off at midday.               */
  plates: {
    master: "hero_photo.png",   // dusk / lights on (current live hero)
    dawn:   null,   // e.g. "hero_dawn.avif"
    day:    null,   // e.g. "hero_day.avif"  ← generate first
    dusk:   null,   // master already is dusk — leave null
    night:  null    // e.g. "hero_night.avif"
  },
  mobilePlates: {   // optional 9:16 portrait crops, same keys
    master: null, dawn: null, day: null, dusk: null, night: null
  },

  /* ---- Season & weather ----------------------------------- */
  seasons: { enabled: true, spring: true, summer: true, autumn: true, winter: true },
  weather: {
    enabled: true,
    persistHours: 3,
    allow: { clear: true, partlyCloudy: true, overcast: true,
             rain: true, mist: true, snow: true, postRain: true }
  },
  holidayTreatment: "off",  // decorations NEVER automatic

  /* ---- Life & motion (0 = off, 1 = full) ------------------ */
  animationIntensity: 0.8,
  interiorLights: true,
  exteriorLights: true,
  occupantSilhouettes: false,
  birds: true,
  fireflies: true,
  rainFx: true,
  snowFx: true,
  windMotion: true,
  audio: false,             // ALWAYS default off
  reducedDataMode: false,

  /* ---- Light glow positions -------------------------------
     Percent coordinates of the hero image, measured from the
     actual photograph. w/h are glow radii in %.
     Windows: bay window, door sidelights, door transom,
     right window, far-right window.                          */
  windowLights: [
    { x: 45.9, y: 56.7, w: 4.6, h: 5.2 },   // left bay window
    { x: 62.6, y: 54.1, w: 1.2, h: 3.2 },   // door sidelight (left)
    { x: 68.7, y: 52.4, w: 1.2, h: 3.2 },   // door sidelight (right)
    { x: 64.6, y: 48.8, w: 1.8, h: 1.4 },   // transom above door
    { x: 82.8, y: 54.7, w: 3.6, h: 5.0 },   // right window
    { x: 93.2, y: 54.0, w: 1.8, h: 2.4 }    // far-right small window
  ],
  porchLights: [
    { x: 60.8, y: 48.6, w: 1.7, h: 2.2 },   // left sconce
    { x: 71.8, y: 47.8, w: 1.7, h: 2.2 }    // right sconce
  ],
  landscapeLights: [
    { x: 56.0, y: 74.9, w: 2.4, h: 1.7 },   // left path bollard
    { x: 74.5, y: 75.1, w: 2.4, h: 1.7 },   // right path bollard
    { x: 47.0, y: 71.0, w: 5.0, h: 2.2 },   // left garden bed wash
    { x: 81.0, y: 71.0, w: 5.0, h: 2.2 }    // right garden bed wash
  ],

  /* ---- Greeting (Phase 4 — default off until approved) ---- */
  greeting: { enabled: false, selector: "[data-hw-greeting]" },

  /* ---- Location fallback (sun math only, never sent) ------ */
  fallbackLatitude: 36.8,

  /* ---- Concierge overlay slots (Phase 5 scaffold) --------- */
  conciergeOverlays: false
};
