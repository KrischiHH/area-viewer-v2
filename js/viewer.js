// @ts-check
// Alternative modularer Viewer (nutzen, wenn du nicht das Inline-Skript in viewer.html verwendest)

/**
 * Fetch mit Timeout (vereinheitlichte Variante).
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

/**
 * Initialisiert den Viewer.
 * Erwartete DOM-Struktur (Beispiel):
 * <div id="loading-status"></div>
 * <div id="ar-container" style="display:none;">
 *   <model-viewer id="ar-scene-element"></model-viewer>
 *   <button id="ar-button">AR START</button>
 * </div>
 * @param {string} sceneId
 * @param {string} workerBase
 */
async function initializeViewer(sceneId, workerBase) {
  const loadingStatus = document.getElementById('loading-status');
  const container = document.getElementById('ar-container');
  const mvEl = document.getElementById('ar-scene-element');
  const arButton = document.getElementById('ar-button');

  if (!loadingStatus || !container || !mvEl) {
    console.error('Erwartete DOM-Elemente fehlen.');
    return;
  }
  if (mvEl.tagName !== 'MODEL-VIEWER') {
    loadingStatus.textContent = 'Fehler: falsches Element (erwartet <model-viewer>).';
    return;
  }

  let config;
  try {
    config = await loadSceneConfig(sceneId, workerBase);
  } catch (e) {
    loadingStatus.textContent = 'Fehler: ' + e.message;
    return;
  }

  if (!config.model || !config.model.url) {
    loadingStatus.textContent = 'Fehler: Kein Modell in Konfiguration.';
    return;
  }

  // Basisattribute
  const modelUrl = `${workerBase}/scenes/${sceneId}/${config.model.url}`;
  mvEl.setAttribute('src', modelUrl);
  mvEl.setAttribute('ar', '');
  mvEl.setAttribute('ar-modes', 'webxr scene-viewer quick-look');
  mvEl.setAttribute('camera-controls', '');
  mvEl.setAttribute('loading', 'eager');
  mvEl.setAttribute('shadow-intensity', '1');
  mvEl.setAttribute('auto-rotate', '');
  mvEl.setAttribute('auto-rotate-delay', '1500');
  mvEl.setAttribute('alt', config.meta?.title || '3D Modell');
  mvEl.setAttribute('interaction-prompt', 'none');

  if (config.environmentImage) {
    mvEl.setAttribute('environment-image', config.environmentImage);
  }
  if (typeof config.exposure === 'number') {
    mvEl.setAttribute('exposure', String(config.exposure));
  }

  // Hotspots (vereinfachte Version)
  createHotspotsFromClickableNodes(mvEl, config.clickableNodes);

  // Anzeige
  loadingStatus.style.display = 'none';
  container.style.display = 'block';

  // Modell fertig geladen
  mvEl.addEventListener('load', () => {
    console.log('Modell geladen.');
    mvEl.removeAttribute('auto-rotate');
  });

  mvEl.addEventListener('error', (e) => {
    console.error('model-viewer Fehler:', e);
    loadingStatus.textContent = 'Fehler beim Laden des Modells.';
    loadingStatus.style.display = 'block';
    container.style.display = 'none';
  });

  // AR Status
  mvEl.addEventListener('ar-status', (event) => {
    if (event.detail.status === 'session-started') {
      console.log('AR Session gestartet.');
    }
    if (event.detail.status === 'session-ended') {
      console.log('AR Session beendet.');
    }
    if (event.detail.status === 'error') {
      alert(`AR Fehler: ${event.detail.message}`);
    }
  });

  // Optionaler Button zum Starten (Fallback)
  if (arButton) {
    arButton.addEventListener('click', () => {
      mvEl.activateAR();
    });
  }

  // Optionale Klick-Aktion (erster Link aus clickableNodes)
  mvEl.addEventListener('click', () => {
    if (Array.isArray(config.clickableNodes) && config.clickableNodes.length > 0) {
      const link = config.clickableNodes[0];
      if (link.url) {
        window.open(link.url, '_blank');
      }
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const sceneId = params.get('scene');
  const workerBase = params.get('base');

  const loadingStatus = document.getElementById('loading-status');
  if (!sceneId || !workerBase) {
    if (loadingStatus) {
      loadingStatus.textContent = 'Fehler: Szene ID oder base Parameter fehlt.';
    }
    return;
  }

  initializeViewer(sceneId, workerBase);
});
