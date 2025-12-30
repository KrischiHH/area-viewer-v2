// Sprachauswahl & Übersetzungen
let currentLang = "de";
let translations = {};

// Sprachdateien richtig laden (angepasst!)
async function setLanguage(lang = "de") {
  currentLang = lang;
  const res = await fetch(`json/lang/${lang}.json`);
  translations = await res.json();
  applyTranslations();
}
function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if(translations[key]) el.textContent = translations[key];
  });
  document.title = translations["title"] || "AR Viewer";
}

// HIER: Angepasste Funktion für GLB-Link aus base und scene!
function getGLBUrl() {
  const params = new URLSearchParams(window.location.search);
  const scene = params.get("scene");
  const base = params.get("base");
  if (scene && base) {
    const sanitizedBase = base.replace(/\/$/, '');
    // Im Beispiel: base=https://area-publish-proxy... UND scene=santa-tanzt-... => base/scene.glb!
    return `${sanitizedBase}/${scene}.glb`;
  }
  return scene || "";
}

// HIER: Modell hinzufügen (keine Änderung nötig)
function addModel(glbUrl) {
  const root = document.getElementById('model-root');
  if (!glbUrl) return;
  const model = document.createElement('a-entity');
  model.setAttribute('gltf-model', glbUrl);
  model.setAttribute('gesture-detector', '');
  model.setAttribute('animation-mixer', '');
  root.innerHTML = "";
  root.appendChild(model);
}

// Galerie-Logik (wie gehabt)... (kann gleich bleiben oder dein Code)

window.addEventListener("DOMContentLoaded", async () => {
  await setLanguage("de");
  document.getElementById('lang-switch').addEventListener('change', (e) => setLanguage(e.target.value));
  document.getElementById('photo-btn').addEventListener('click', capturePhoto);
  document.getElementById('gallery-btn').addEventListener('click', showGallery);
  document.getElementById('close-gallery').addEventListener('click', closeGallery);
  document.getElementById('video-btn').addEventListener('mousedown', startVideoRecording);
  document.getElementById('video-btn').addEventListener('mouseup', stopVideoRecording);

  // HIER: GLB laden mit neuem Getter
  const glb = getGLBUrl();
  if(glb) addModel(glb);
});

// (animation-mixer, capturePhoto, Video etc. wie gehabt...)
