let arAudio = null;
let isAudioMuted = false;

export function initAudio(state) {
  const cfg = state.cfg;
  const sceneId = state.sceneId;
  const workerBase = state.workerBase;
  const btnMute = document.getElementById('btn-mute');

  if (!cfg?.audio?.url || !btnMute) {
    if (btnMute) btnMute.style.display = 'none';
    return;
  }

  const audioUrl = `${workerBase}/scenes/${sceneId}/${cfg.audio.url}`;
  arAudio = new Audio(audioUrl);
  arAudio.loop = !!cfg.audio.loop;
  arAudio.volume = cfg.audio.volume !== undefined ? cfg.audio.volume : 0.8;
  btnMute.style.display = 'flex';
  updateMuteButtonUI(btnMute);

  btnMute.onclick = () => {
    isAudioMuted = !isAudioMuted;
    if (arAudio) arAudio.muted = isAudioMuted;
    updateMuteButtonUI(btnMute);
  };
}

function updateMuteButtonUI(btn) {
  btn.textContent = isAudioMuted ? '🔇' : '🔊';
}

export function toggleAudio(play) {
  if (!arAudio) return;
  if (play) {
    if (!isAudioMuted) {
      const delay = window?.cfg?.audio?.delaySeconds || 0;
      if (delay > 0) {
        setTimeout(() => arAudio.play().catch(e=>console.warn('Audio play failed', e)), delay * 1000);
      } else {
        arAudio.play().catch(e=>console.warn('Audio play failed', e));
      }
    }
  } else {
    arAudio.pause();
    arAudio.currentTime = 0;
  }
}
