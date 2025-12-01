export function showLoading() {
  const el = document.getElementById('loading-status');
  if (el) el.style.display = 'flex';
}
export function hideLoading() {
  const el = document.getElementById('loading-status');
  if (el) el.style.display = 'none';
}

export function showPoster(state) {
  const poster = document.getElementById('poster');
  if (poster) poster.style.display = 'flex';
  const title = document.getElementById('posterTitle');
  const text = document.getElementById('posterText');
  if (title) title.textContent = state.cfg?.meta?.title || 'AR Erlebnis';
  if (text) text.textContent = 'Tippe auf START AR, um das Modell in deiner Umgebung zu sehen.';
}

export function hidePoster() {
  const poster = document.getElementById('poster');
  if (poster) poster.style.display = 'none';
}

export function initUI(state) {
  const startBtn = document.getElementById('startAr');
  const mvEl = document.getElementById('ar-scene-element');
  const container = document.getElementById('ar-container');
  if (container) container.style.display = 'block';

  if (startBtn) {
    startBtn.onclick = async () => {
      startBtn.disabled = true;
      if (!mvEl || typeof mvEl.activateAR !== 'function') {
        const errEl = document.getElementById('err');
        if (errEl) {
          errEl.textContent = 'AR wird nicht unterstützt (activateAR fehlt).';
          errEl.style.display = 'block';
        }
        startBtn.disabled = false;
        return;
      }
      try {
        await mvEl.activateAR();
      } catch (err) {
        console.warn('AR Start fehlgeschlagen:', err);
        const errEl = document.getElementById('err');
        if (errEl) {
          errEl.textContent = 'AR Start fehlgeschlagen: ' + (err?.message || err);
          errEl.style.display = 'block';
        }
        startBtn.disabled = false;
      }
      // Sicherheitsnetz: nach 5s reaktivieren, wenn keine Session aktiv
      setTimeout(() => {
        if (!state.arSessionActive) startBtn.disabled = false;
      }, 5000);
    };
  }
}

export function bindARStatus(state, handlers) {
  const mvEl = document.getElementById('ar-scene-element');
  const arUI = document.getElementById('ar-ui');
  const startBtn = document.getElementById('startAr');
  if (!mvEl) return;

  mvEl.addEventListener('ar-status', (e) => {
    const status = e.detail.status;
    if (status === 'session-started') {
      if (arUI) arUI.style.display = 'block';
      handlers.onSessionStart?.();
      mvEl.querySelectorAll('.Hotspot').forEach(h => h.classList.add('in-ar'));
    } else if (status === 'session-ended') {
      if (arUI) arUI.style.display = 'none';
      handlers.onSessionEnd?.();
      mvEl.querySelectorAll('.Hotspot').forEach(h => h.classList.remove('in-ar'));
      if (startBtn) startBtn.disabled = false;
    } else if (status === 'failed') {
      if (arUI) arUI.style.display = 'none';
      handlers.onFailed?.(e.detail.message);
      mvEl.querySelectorAll('.Hotspot').forEach(h => h.classList.remove('in-ar'));
      if (startBtn) startBtn.disabled = false;
    }
  });
}
