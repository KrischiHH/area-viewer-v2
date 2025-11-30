// @ts-check
// Erweiterter modularer Viewer mit Audio, Mute, Screenshot und Aufnahme (simuliert).

/**
 * Fetch mit Timeout und AbortError-Erkennung.
 * @param {string} url
 * @param {RequestInit & { timeoutMs?: number }} options
 * @returns {Promise<Response>}
 */
async function fetchWithTimeout(url, options = {}) {
  const { timeoutMs = 15000 } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(`Timeout (${timeoutMs} ms) beim Laden: ${url}`);
    }
    throw err;
  } finally {
    clearTimeout(id);
  }
}

/**
 * Lädt die Szene-Konfiguration.
 * @param {string} sceneId
 * @param {string} workerBase
 */
async function loadSceneConfig(sceneId, workerBase) {
  const sceneConfigUrl = `${workerBase}/scenes/${sceneId}/scene.json`;
  const res = await fetchWithTimeout(sceneConfigUrl, { timeoutMs: 15000 });
  if (!res.ok) {
    throw new Error(`Scene-Konfiguration konnte nicht geladen werden (${res.status})`);
  }
  return res.json();
}

/**
 * Erstellt Hotspots aus clickableNodes (falls vorhanden).
 * @param {HTMLElement} mvEl
 * @param {Array<{label:string,url:string}>} clickableNodes
 */
function createHotspotsFromClickableNodes(mvEl, clickableNodes) {
  if (!Array.isArray(clickableNodes) || clickableNodes.length === 0) return;

  clickableNodes.forEach((node, idx) => {
    if (!node.url) return;
    const slotName = `hotspot-${(node.label || 'link'+idx)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g,'-')
      .replace(/^-+|-+$/g,'')}`;

    const hotspot = document.createElement('button');
    hotspot.setAttribute('slot', slotName);
    hotspot.className = 'Hotspot';
    hotspot.textContent = node.label || `Link ${idx+1}`;
    hotspot.addEventListener('click', (e) => {
      e.stopPropagation();
      window.open(node.url, '_blank');
    });
    mvEl.appendChild(hotspot);
  });
}

/* -------- Globale Zustände -------- */
let cfg = null;
let arAudio = null;
let isAudioMuted = false;
let arSessionActive = false;
let isRecording = false;
let recTimer = 0;
let recordingTimerId = null;

/* -------- DOM Referenzen -------- */
const loadingStatus = document.getElementById('loading-status');
const container = document.getElementById('ar-container');
const poster = document.getElementById('poster');
const posterTitle = document.getElementById('posterTitle');
const posterText = document.getElementById('posterText');
const startArButton = document.getElementById('startAr');
const mvEl = document.getElementById('ar-scene-element');
const arUI = document.getElementById('ar-ui');
const btnMute = document.getElementById('btn-mute');
const btnShutter = document.getElementById('btn-shutter');
const recInfo = document.getElementById('rec-info');
const errEl = document.getElementById('err');

/* -------- Hilfsfunktionen UI/Logik -------- */
function displayError(message) {
  console.error('VIEWER ERROR:', message);
  if (errEl) {
    errEl.textContent = 'FEHLER: ' + message;
    errEl.style.display = 'block';
  }
  if (loadingStatus) loadingStatus.textContent = 'Fehler: ' + message;
}

function updateMuteButtonUI() {
  if (!btnMute) return;
  btnMute.textContent = isAudioMuted ? '🔇' : '🔊';
}

function initAudio(audioCfg, sceneId, workerBase) {
  if (!btnMute) return;
  if (!audioCfg || !audioCfg.url) {
    btnMute.style.display = 'none';
    return;
  }
  const audioUrl = `${workerBase}/scenes/${sceneId}/${audioCfg.url}`;
  arAudio = new Audio(audioUrl);
  arAudio.loop = !!audioCfg.loop;
  arAudio.volume = audioCfg.volume !== undefined ? audioCfg.volume : 0.8;

  btnMute.style.display = 'flex';
  updateMuteButtonUI();
  btnMute.onclick = () => {
    isAudioMuted = !isAudioMuted;
    arAudio.muted = isAudioMuted;
    updateMuteButtonUI();
  };
}

function toggleAudio(play) {
  if (!arAudio) return;
  if (play) {
    if (!isAudioMuted) {
      const delay = cfg?.audio?.delaySeconds || 0;
      if (delay > 0) {
        setTimeout(() => arAudio.play().catch(e => console.warn('Audio play failed:', e)), delay * 1000);
      } else {
        arAudio.play().catch(e => console.warn('Audio play failed:', e));
      }
    }
  } else {
    arAudio.pause();
    arAudio.currentTime = 0;
  }
}

function applyYOffset(yOffset) {
  if (typeof yOffset !== 'number') return;
  // Nur im 3D-Viewer sichtbar (AR ignoriert CSS transform)
  const px = (-yOffset * 100).toFixed(0) + 'px';
  document.documentElement.style.setProperty('--model-vertical-offset', px);
  console.log(`Y-Offset angewandt (nur Nicht-AR 3D-Ansicht): ${px}`);
}

/* ---------- Aufnahme & Screenshot ---------- */
function formatTime(seconds) {
  const min = String(Math.floor(seconds / 60)).padStart(2,'0');
  const sec = String(seconds % 60).padStart(2,'0');
  return `${min}:${sec}`;
}

function startRecordingTimer() {
  recTimer = 0;
  if (recInfo) {
    recInfo.textContent = formatTime(recTimer);
    recInfo.style.display = 'flex';
  }
  if (btnShutter) btnShutter.classList.add('recording');
  recordingTimerId = setInterval(() => {
    recTimer++;
    if (recInfo) recInfo.textContent = formatTime(recTimer);
    if (recTimer >= 60) {
      stopRecording();
    }
  }, 1000);
}

function stopRecording() {
  if (recordingTimerId) {
    clearInterval(recordingTimerId);
    recordingTimerId = null;
  }
  isRecording = false;
  if (btnShutter) btnShutter.classList.remove('recording');
  if (recInfo) recInfo.style.display = 'none';
  console.log("Videoaufnahme gestoppt (simuliert).");
}

function takeScreenshot() {
  if (!mvEl || typeof mvEl.toBlob !== 'function') {
    console.warn('toBlob() nicht verfügbar in dieser model-viewer Version.');
    return;
  }
  btnShutter?.classList.add('snap');
  setTimeout(() => btnShutter?.classList.remove('snap'), 300);

  mvEl.toBlob({ mimeType: 'image/png' })
    .then(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ARea_Screenshot.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    })
    .catch(e => console.error('Screenshot fehlgeschlagen:', e));
}

/* ---------- Szene laden & konfigurieren ---------- */
async function initializeViewer(sceneId, workerBase) {
  if (!mvEl || mvEl.tagName !== 'MODEL-VIEWER') {
    displayError('model-viewer Element fehlt oder falsch.');
    return;
  }

  let config;
  try {
    config = await loadSceneConfig(sceneId, workerBase);
  } catch (e) {
    displayError(e.message);
    return;
  }
  cfg = config;

  if (!cfg.model || !cfg.model.url) {
    displayError('Kein 3D-Modell in Konfiguration.');
    return;
  }

  const modelUrl = `${workerBase}/scenes/${sceneId}/${cfg.model.url}`;
  mvEl.setAttribute('src', modelUrl);
  mvEl.setAttribute('alt', cfg.meta?.title || '3D Modell');
  mvEl.setAttribute('shadow-intensity', '1');
  mvEl.setAttribute('camera-controls', '');
  mvEl.setAttribute('auto-rotate', '');
  mvEl.setAttribute('ar', '');
  mvEl.setAttribute('ar-modes', 'webxr scene-viewer quick-look');
  mvEl.setAttribute('interaction-prompt', 'none');
  mvEl.setAttribute('auto-rotate-delay', '1000');
  mvEl.setAttribute('disable-tap', '');

  if (cfg.environmentImage) {
    mvEl.setAttribute('environment-image', cfg.environmentImage);
  }
  if (typeof cfg.exposure === 'number') {
    mvEl.setAttribute('exposure', String(cfg.exposure));
  }

  // Hotspots aus clickableNodes
  createHotspotsFromClickableNodes(mvEl, cfg.clickableNodes);

  // Audio init
  initAudio(cfg.audio, sceneId, workerBase);

  // Y-Offset nur für 3D-Modus
  if (typeof cfg.model.yOffset === 'number') {
    applyYOffset(cfg.model.yOffset);
  }

  // Poster-Texte aktualisieren
  if (posterTitle) posterTitle.textContent = cfg.meta?.title || 'AR Erlebnis';
  if (posterText) posterText.textContent = 'Tippe auf START AR, um das Modell in deiner Umgebung zu sehen.';

  // Anzeige wechseln
  if (loadingStatus) loadingStatus.style.display = 'none';
  if (container) container.style.display = 'block';

  mvEl.addEventListener('load', () => {
    console.log('Modell geladen.');
    mvEl.removeAttribute('auto-rotate');
  });

  mvEl.addEventListener('error', (e) => {
    console.error('model-viewer Fehler:', e);
    displayError('Fehler beim Laden des Modells.');
    if (container) container.style.display = 'none';
  });

  // AR Status Handling
  mvEl.addEventListener('ar-status', (event) => {
    const status = event.detail.status;
    if (status === 'session-started') {
      arSessionActive = true;
      poster && (poster.style.display = 'none');
      arUI && (arUI.style.display = 'block');
      toggleAudio(true);
    } else if (status === 'session-ended') {
      arSessionActive = false;
      arUI && (arUI.style.display = 'none');
      toggleAudio(false);
      poster && (poster.style.display = 'flex');
      if (isRecording) stopRecording();
    } else if (status === 'failed') {
      arSessionActive = false;
      startArButton && (startArButton.disabled = false);
      displayError('AR konnte nicht gestartet werden.');
    }
  });

  // Shutter-Logik
  btnShutter?.addEventListener('click', () => {
    if (isRecording) {
      stopRecording();
    } else {
      takeScreenshot();
    }
  });

  btnShutter?.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (isRecording) return;
    if (arSessionActive) {
      isRecording = true;
      btnShutter.classList.add('recording');
      startRecordingTimer();
      console.log("Videoaufnahme gestartet (simuliert).");
    } else {
      console.warn("Videoaufnahme nur während aktiver AR-Session möglich.");
    }
  });

  // Vereinfachter Klick für ersten Link (falls keine Hotspots genutzt werden)
  mvEl.addEventListener('click', () => {
    if (!cfg.clickableNodes || cfg.clickableNodes.length === 0) return;
    const node = cfg.clickableNodes[0];
    if (node?.url) {
      if (arSessionActive) {
        mvEl.dismissAR?.();
        setTimeout(() => window.open(node.url, '_blank'), 600);
      } else {
        window.open(node.url, '_blank');
      }
    }
  });
}

/* ---------- Bootstrap ---------- */
document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const sceneId = params.get('scene');
  const workerBase = params.get('base');

  if (!sceneId || !workerBase) {
    displayError('Fehlende URL-Parameter (scene/base).');
    return;
  }

  // START AR Button
  if (startArButton) {
    startArButton.onclick = () => {
      startArButton.disabled = true;
      mvEl.activateAR();
      // Fallback: Falls AR nicht startet
      setTimeout(() => {
        if (!arSessionActive) startArButton.disabled = false;
      }, 5000);
    };
  }

  // Initial Start
  initializeViewer(sceneId, workerBase);
});
