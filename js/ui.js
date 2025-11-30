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
    startBtn.onclick = () => {
      startBtn.disabled = true;
      mvEl.activateAR();
      setTimeout(() => {
        if (!state.arSessionActive) startBtn.disabled = false;
      }, 5000);
    };
  }
}

export function bindARStatus(state, handlers) {
  const mvEl = document.getElementById('ar-scene-element');
  const arUI = document.getElementById('ar-ui');

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
    } else if (status === 'failed') {
      if (arUI) arUI.style.display = 'none';
      handlers.onFailed?.(e.detail.message);
    }
  });
}
