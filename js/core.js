export function initCore() {
  const mvEl = document.getElementById('ar-scene-element');
  if (!mvEl || mvEl.tagName !== 'MODEL-VIEWER') {
    throw new Error('model-viewer Element fehlt oder ist ungültig.');
  }
  return mvEl;
}

export async function loadConfig(sceneId, workerBase) {
  const url = `${workerBase}/scenes/${sceneId}/scene.json`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`Konfiguration nicht ladbar (${res.status})`);
    return await res.json();
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('Timeout beim Laden der Konfiguration.');
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}

export function configureModel(cfg, sceneId, workerBase) {
  const mvEl = initCore();
  if (!cfg.model || !cfg.model.url) {
    throw new Error('Kein Modell in der Konfiguration.');
  }
  const modelUrl = `${workerBase}/scenes/${sceneId}/${cfg.model.url}`;

  mvEl.setAttribute('src', modelUrl);
  mvEl.setAttribute('alt', cfg.meta?.title || '3D Modell');
  mvEl.setAttribute('shadow-intensity', '1');
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
  if (typeof cfg.model.yOffset === 'number') {
    const px = (-cfg.model.yOffset * 100).toFixed(0) + 'px';
    document.documentElement.style.setProperty('--model-vertical-offset', px);
  }

  mvEl.addEventListener('load', () => {
    mvEl.removeAttribute('auto-rotate');
    console.log('Modell geladen.');
  });
}
