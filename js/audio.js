let audioEl = null;
let isAudioMuted = false;

export function initAudio(state) {
  const cfg = state.cfg;
  const sceneId = state.sceneId;
  const workerBase = state.workerBase;
  const btnMute = document.getElementById('btn-mute');

  // Keine Audio-Konfig vorhanden → Button verstecken
  if (!cfg?.audio?.url || !btnMute) {
    if (btnMute) btnMute.style.display = 'none';
    return;
  }

  const audioUrl = `${workerBase}/scenes/${sceneId}/${cfg.audio.url}`;

  if (cfg.audio.embedElement) {
    // Persistentes Audio-Element in den DOM einfügen
    audioEl = document.getElementById('scene-audio');
    if (!audioEl) {
      audioEl = document.createElement('audio');
      audioEl.id = 'scene-audio';
      audioEl.style.display = 'none'; // unsichtbar
      document.body.appendChild(audioEl);
    }
    audioEl.src = audioUrl;
    audioEl.loop = !!cfg.audio.loop;
    audioEl.volume = cfg.audio.volume !== undefined ? cfg.audio.volume : 0.8;
  } else {
    // Fallback: temporäres Audio-Element (nicht empfohlen für Recording)
    audioEl = new Audio(audioUrl);
    audioEl.loop = !!cfg.audio.loop;
    audioEl.volume = cfg.audio.volume !== undefined ? cfg.audio.volume : 0.8;
  }

  // UI
  btnMute.style.display = 'flex';
  updateMuteButtonUI(btnMute);

  btnMute.onclick = () => {
    isAudioMuted = !isAudioMuted;
    if (audioEl) audioEl.muted = isAudioMuted;
    updateMuteButtonUI(btnMute);
  };
}

function updateMuteButtonUI(btn) {
  btn.textContent = isAudioMuted ? '🔇' : '🔊';
}

export function toggleAudio(play) {
  if (!audioEl) return;
  if (play) {
    if (!isAudioMuted) {
      const delay = Number.isFinite(window?.cfg?.audio?.delaySeconds)
        ? window.cfg.audio.delaySeconds
        : 0;
      const doPlay = () => audioEl.play().catch(e => console.warn('Audio play failed', e));
      if (delay > 0) {
        setTimeout(doPlay, delay * 1000);
      } else {
        doPlay();
      }
    }
  } else {
    audioEl.pause();
    audioEl.currentTime = 0;
  }
}

// Für MediaRecorder: Stelle eine Funktion bereit, die das persistente AudioElement liefert
export function getPersistentAudioElement() {
  return audioEl && audioEl.id === 'scene-audio' ? audioEl : null;
}
