import { initCore, loadConfig, configureModel } from './core.js';
import { initUI, showLoading, hideLoading, showPoster, hidePoster, bindARStatus } from './ui.js';
import { initAudio, toggleAudio, pauseAudioOnHide } from './audio.js';
import { initHotspots } from './hotspots.js';
import { initRecording, stopRecordingOnARSessionEnd } from './recording.js';

let state = {
  cfg: null,
  sceneId: null,
  workerBase: null,
  arSessionActive: false
};

document.addEventListener('DOMContentLoaded', async () => {
  showLoading();
  const params = new URLSearchParams(window.location.search);
  state.sceneId = params.get('scene');
  state.workerBase = params.get('base');

  if (!state.sceneId || !state.workerBase) {
    hideLoading();
    const errEl = document.getElementById('err');
    if (errEl) {
      errEl.textContent = 'FEHLENDE URL PARAMETER (scene/base)';
      errEl.style.display = 'block';
    }
    return;
  }

  initUI(state);

  try {
    state.cfg = await loadConfig(state.sceneId, state.workerBase);
    configureModel(state.cfg, state.sceneId, state.workerBase);
    initAudio(state);
    pauseAudioOnHide();
    initHotspots(state);
    initRecording(state);
    hideLoading();
    showPoster(state);
  } catch (e) {
    hideLoading();
    const errEl = document.getElementById('err');
    if (errEl) {
      errEl.textContent = 'FEHLER: ' + e.message;
      errEl.style.display = 'block';
    }
    console.error(e);
    return;
  }

  bindARStatus(state, {
    onSessionStart() {
      state.arSessionActive = true;
      hidePoster();
      toggleAudio(true);
    },
    onSessionEnd() {
      state.arSessionActive = false;
      showPoster(state);
      toggleAudio(false);
      stopRecordingOnARSessionEnd();
      // START AR Button wieder aktivieren für neue Session
      const startBtn = document.getElementById('startAr');
      if (startBtn) startBtn.disabled = false;
    },
    onFailed(msg) {
      state.arSessionActive = false;
      const errEl = document.getElementById('err');
      if (errEl) {
        errEl.textContent = 'AR FEHLER: ' + msg;
        errEl.style.display = 'block';
      }
      const startBtn = document.getElementById('startAr');
      if (startBtn) startBtn.disabled = false;
    }
  });
});
