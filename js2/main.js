// Sprachauswahl & Übersetzungen
let currentLang = "de";
let translations = {};

// Lade Übersetzungen
async function setLanguage(lang = "de") {
  currentLang = lang;
  const res = await fetch(`lang/${lang}.json`);
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

// AR Modell einfügen (GLB von URL-Param)
function getGLBUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("scene") || "";
}
function addModel(glbUrl) {
  const root = document.getElementById('model-root');
  if (!glbUrl) return;
  const model = document.createElement('a-entity');
  model.setAttribute('gltf-model', glbUrl);
  // Interaktiv: rotation, scale, position
  model.setAttribute('draggable', true); // Custom behaviour via JS
  model.setAttribute('gesture-detector', '');
  model.setAttribute('animation-mixer', '');
  root.innerHTML = "";
  root.appendChild(model);
}

// Galerie-Logik: Speicherung in sessionStorage
const galleryKey = "ar_gallery";
function saveToGallery(item) {
  let gal = JSON.parse(sessionStorage.getItem(galleryKey)) || [];
  gal.push(item);
  sessionStorage.setItem(galleryKey, JSON.stringify(gal));
}
function loadGallery() {
  return JSON.parse(sessionStorage.getItem(galleryKey)) || [];
}
function showGallery() {
  const modal = document.getElementById('gallery-modal');
  const gal = loadGallery();
  const content = document.getElementById('gallery-content');
  content.innerHTML = "";
  if (gal.length === 0) {
    content.innerHTML = "<p>Keine Aufnahmen.</p>";
  } else {
    gal.forEach((item, i) => {
      if(item.type === "photo") {
        const img = document.createElement('img');
        img.src = item.data;
        img.alt = `Foto ${i+1}`;
        content.appendChild(img);
      }
      if(item.type === "video") {
        const vid = document.createElement('video');
        vid.controls = true;
        vid.src = item.data;
        vid.width = 160;
        content.appendChild(vid);
      }
    });
  }
  modal.classList.remove('hidden');
}
function closeGallery() {
  document.getElementById('gallery-modal').classList.add('hidden');
}

// Foto aufnehmen (Canvas Snapshot)
function capturePhoto() {
  const scene = document.querySelector('canvas');
  const data = scene.toDataURL('image/png');
  saveToGallery({type: "photo", data});
  alert(translations["photo_saved"] || "Foto gespeichert!");
}

// Videoaufnahme (MediaRecorder, browser support prüfen!)
let mediaRecorder, recordedChunks = [];
async function startVideoRecording() {
  const scene = document.querySelector('canvas');
  if (!scene.captureStream) {
    alert("Videoaufnahme nicht unterstützt.");
    return;
  }
  let stream = scene.captureStream();
  recordedChunks = [];
  mediaRecorder = new MediaRecorder(stream);

  mediaRecorder.ondataavailable = (e) => { if(e.data.size > 0) recordedChunks.push(e.data); };
  mediaRecorder.onstop = (e) => {
    let blob = new Blob(recordedChunks, {type: 'video/webm'});
    let url = URL.createObjectURL(blob);
    saveToGallery({type: "video", data: url});
    alert(translations["video_saved"] || "Video gespeichert!");
  };
  mediaRecorder.start();
  // UI: Button blinkt, nach x Sekunden wird automatisch gestoppt, oder Button erneut drücken zum Stoppen
  document.getElementById('video-btn').textContent = "⏹️ Stop";
}
function stopVideoRecording() {
  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
    document.getElementById('video-btn').textContent = translations["record_video"] || "Video aufnehmen";
  }
}

// Gesture/Interaktions-Logik (nur angedeutet, Details per Plugin)
AFRAME.registerComponent('gesture-detector', {
  init: function() {
    // TODO: Hier könnten Pinch/Zoom/Rotate implementiert werden.
  }
});

// Event Handler
window.addEventListener("DOMContentLoaded", async () => {
  await setLanguage("de");
  document.getElementById('lang-switch').addEventListener('change', (e) => setLanguage(e.target.value));
  document.getElementById('photo-btn').addEventListener('click', capturePhoto);
  document.getElementById('gallery-btn').addEventListener('click', showGallery);
  document.getElementById('close-gallery').addEventListener('click', closeGallery);
  document.getElementById('video-btn').addEventListener('mousedown', startVideoRecording);
  document.getElementById('video-btn').addEventListener('mouseup', stopVideoRecording);

  // Modell laden
  const glb = getGLBUrl();
  if(glb) addModel(glb);
});
