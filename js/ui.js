// js/ui.js
// UI-Hilfsfunktionen für den Viewer, passend zu index.js

// Lade-Overlay ein/aus
export function showLoading() {
  const el = document.getElementById('loading-status');
  if (el) el.style.display = 'flex';
}

export function hideLoading() {
  const el = document.getElementById('loading-status');
  if (el) el.style.display = 'none';
}

// Poster ein/aus
export function showPoster(state) {
  const poster        = document.getElementById('poster');
  const titleEl       = document.getElementById('posterTitle');
  const subtitleEl    = document.getElementById('posterSubtitle');
  const textEl        = document.getElementById('posterText');
  const mediaWrapper  = document.getElementById('poster-media');
  const imgEl         = document.getElementById('posterImageEl');

  const meta = state?.cfg?.meta || {};
  const title    = meta.title    || 'AR Erlebnis';
  const subtitle = meta.subtitle || '';
  const body     = meta.body     || 'Tippe auf START AR, um das Modell in deiner Umgebung zu sehen.';

  if (titleEl)   titleEl.textContent = title;
  if (textEl)    textEl.textContent  = body;

  // Subline ein-/ausblenden
  if (subtitleEl) {
    if (subtitle.trim()) {
      subtitleEl.textContent = subtitle;
      subtitleEl.classList.remove('hidden');
    } else {
      subtitleEl.textContent = '';
      subtitleEl.classList.add('hidden');
    }
  }

  // Posterbild aus meta.posterImage
  if (mediaWrapper && imgEl) {
    const imgName = meta.posterImage;
    if (imgName && state?.workerBase && state?.sceneId) {
      const url = `${state.workerBase}/scenes/${state.sceneId}/${imgName}`;
      imgEl.src = url;
      mediaWrapper.classList.remove('hidden');
    } else {
      imgEl.removeAttribute('src');
      mediaWrapper.classList.add('hidden');
    }
  }

  if (poster) poster.style.display = 'flex';
}

export function hidePoster() {
  const poster = document.getElementById('poster');
  if (poster) poster.style.display = 'none';
}

// UI-Grundverdrahtung: Start-Button, Galerie-Buttons etc.
export function initUI(state) {
  const startBtn      = document.getElementById('startAr');
  const mvEl          = document.getElementById('ar-scene-element');
  const btnGallery    = document.getElementById('btn-gallery');
  const btnGalleryClose = document.getElementById('btn-gallery-close');
  const galleryPanel  = document.getElementById('gallery-panel');

  // START AR-Button
  if (startBtn && mvEl) {
    startBtn.addEventListener('click', () => {
      startBtn.disabled = true;
      try {
        mvEl.activateAR();
      } catch (e) {
        console.error('activateAR() fehlgeschlagen:', e);
        startBtn.disabled = false;
      }
      // Fallback, falls AR nicht startet
      setTimeout(() => {
        if (!state.arSessionActive) {
          startBtn.disabled = false;
        }
      }, 5000);
    });
  }

  // Galerie öffnen/schließen (Aufnahmen-UI)
  if (btnGallery && btnGalleryClose && galleryPanel) {
    btnGallery.addEventListener('click', () => {
      galleryPanel.style.display = 'flex';
    });
    btnGalleryClose.addEventListener('click', () => {
      galleryPanel.style.display = 'none';
    });
  }
}

// AR-Status an index.js-Callbacks durchreichen
export function bindARStatus(state, { onSessionStart, onSessionEnd, onFailed }) {
  const mvEl = document.getElementById('ar-scene-element');
  if (!mvEl) return;

  mvEl.addEventListener('ar-status', (event) => {
    const status = event.detail?.status;

    if (status === 'session-started') {
      onSessionStart && onSessionStart();
      // UI: AR-HUD sichtbar machen
      const arUI = document.getElementById('ar-ui');
      if (arUI) arUI.style.display = 'block';

      // Hotspots im AR-Modus hervorheben
      mvEl.querySelectorAll('.Hotspot').forEach(h => h.classList.add('in-ar'));
    } else if (status === 'session-ended') {
      onSessionEnd && onSessionEnd();
      const arUI = document.getElementById('ar-ui');
      if (arUI) arUI.style.display = 'none';
      mvEl.querySelectorAll('.Hotspot').forEach(h => h.classList.remove('in-ar'));
    } else if (status === 'failed') {
      const msg = event.detail?.reason || 'AR konnte nicht gestartet werden.';
      onFailed && onFailed(msg);
    }
  });
}
