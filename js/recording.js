import { getPersistentAudioElement } from './audio.js';

// Screenshot & echte/Simulierte Aufnahme
const MAX_RECORD_TIME_SECONDS = 600; // 10 Minuten
let recTimer = 0;
let simulatedRecordingId = null;
let mediaRecorder = null;
let recordedChunks = [];
let isRecordingReal = false;
let realTimerId = null;
let audioCtxRef = null; // Für Cleanup nach echter Aufnahme

export function initRecording(state) {
  const btnShutter = document.getElementById('btn-shutter');
  const btnRecord = document.getElementById('btn-record');
  const recInfo = document.getElementById('rec-info');
  const mvEl = document.getElementById('ar-scene-element');

  if (btnShutter) {
    btnShutter.addEventListener('click', () => {
      takeScreenshot(mvEl);
    });
  }

  if (btnRecord) {
    btnRecord.addEventListener('click', () => {
      if (isRecordingReal || simulatedRecordingId) {
        stopAllRecording(recInfo, btnRecord);
      } else {
        if (canRecordReal(mvEl)) {
          startRealRecording(mvEl, recInfo, btnRecord);
        } else {
          console.warn('MediaRecorder nicht verfügbar → Fallback Timer.');
          startSimulatedRecording(recInfo, btnRecord);
        }
      }
    });
  }

  window.addEventListener('beforeunload', () => {
    if (isRecordingReal || simulatedRecordingId) {
      try { stopAllRecording(recInfo, btnRecord); } catch(_) {}
    }
  });
}

/* ---------- Screenshot ---------- */
function takeScreenshot(mvEl) {
  if (!mvEl || typeof mvEl.toBlob !== 'function') {
    console.warn('toBlob() nicht verfügbar.');
    return;
  }
  const shutterBtn = document.getElementById('btn-shutter');
  if (shutterBtn) {
    shutterBtn.classList.add('snap');
    setTimeout(() => shutterBtn.classList.remove('snap'), 200);
  }

  mvEl.toBlob({ mimeType: 'image/jpeg', quality: 0.92 })
    .then(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ARea_Screenshot.jpg';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    })
    .catch(e => console.error('Screenshot fehlgeschlagen:', e));
}


/* ---------- Feature Detection ---------- */
function canRecordReal(mvEl) {
  return !!window.MediaRecorder && !!mvEl?.shadowRoot?.querySelector('canvas');
}

/* ---------- Simulierte Aufnahme (Fallback) ---------- */
function startSimulatedRecording(recInfo, btnRecord) {
  recTimer = 0;
  recInfo.textContent = '00:00';
  recInfo.style.display = 'flex';
  btnRecord.classList.add('recording');

  simulatedRecordingId = setInterval(() => {
    recTimer++;
    recInfo.textContent = formatTime(recTimer);
    if (recTimer >= MAX_RECORD_TIME_SECONDS) {
      stopAllRecording(recInfo, btnRecord);
    }
  }, 1000);
}

function formatTime(seconds) {
  if (seconds >= 3600) {
    const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
    const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
    const s = String(seconds % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
  } else {
    const m = String(Math.floor(seconds / 60)).padStart(2,'0');
    const s = String(seconds % 60).padStart(2,'0');
    return `${m}:${s}`;
  }
}

/* ---------- Echte Aufnahme ---------- */
function startRealRecording(mvEl, recInfo, btnRecord) {
  const canvas = mvEl.shadowRoot.querySelector('canvas');
  if (!canvas) {
    console.warn('Kein Canvas für Aufnahme gefunden → Fallback.');
    startSimulatedRecording(recInfo, btnRecord);
    return;
  }

  const stream = canvas.captureStream(30);
  let finalStream = stream;

  const persistentAudio = getPersistentAudioElement();
  if (persistentAudio) {
    try {
      audioCtxRef = new AudioContext();
      const source = audioCtxRef.createMediaElementSource(persistentAudio);
      const dest = audioCtxRef.createMediaStreamDestination();
      source.connect(dest);
      source.connect(audioCtxRef.destination);
      finalStream = new MediaStream([...stream.getVideoTracks(), ...dest.stream.getAudioTracks()]);
    } catch (e) {
      console.warn('Audiomixing fehlgeschlagen:', e);
    }
  }

  const mimeTypeCandidates = [
    'video/webm;codecs=vp9,opus', // bevorzugt: bessere Qualität
    'video/webm;codecs=vp8',
    'video/webm'
  ];
  let chosen = '';
  for (const c of mimeTypeCandidates) {
    if (MediaRecorder.isTypeSupported(c)) { chosen = c; break; }
  }
  if (!chosen) {
    console.warn('Kein unterstützter WebM Codec gefunden → Fallback Simulation.');
    startSimulatedRecording(recInfo, btnRecord);
    return;
  }

  try {
    mediaRecorder = new MediaRecorder(finalStream, { mimeType: chosen });
  } catch (e) {
    console.warn('MediaRecorder Instanziierung fehlgeschlagen → Fallback Simulation.', e);
    startSimulatedRecording(recInfo, btnRecord);
    return;
  }

  recordedChunks = [];
  isRecordingReal = true;
  recTimer = 0;
  recInfo.textContent = '00:00';
  recInfo.style.display = 'flex';
  btnRecord.classList.add('recording');

  realTimerId = setInterval(() => {
    recTimer++;
    recInfo.textContent = formatTime(recTimer);
    if (recTimer >= MAX_RECORD_TIME_SECONDS) {
      stopAllRecording(recInfo, btnRecord);
    }
  }, 1000);

  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) recordedChunks.push(e.data);
  };
  mediaRecorder.onstop = () => {
    if (realTimerId) {
      clearInterval(realTimerId);
      realTimerId = null;
    }
    const blob = new Blob(recordedChunks, { type: chosen });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ARea_Recording.webm';
    a.click();
    URL.revokeObjectURL(url);
    isRecordingReal = false;
    // AudioContext schließen zur Freigabe von Ressourcen
    try { audioCtxRef?.close(); } catch(_) {}
    audioCtxRef = null;
  };

  mediaRecorder.start();
}

function stopAllRecording(recInfo, btnRecord) {
  if (simulatedRecordingId) {
    clearInterval(simulatedRecordingId);
    simulatedRecordingId = null;
  }
  if (realTimerId) {
    clearInterval(realTimerId);
    realTimerId = null;
  }
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
  recInfo.style.display = 'none';
  btnRecord.classList.remove('recording');
  isRecordingReal = false;
  try { audioCtxRef?.close(); } catch(_) {}
  audioCtxRef = null;
}

/* ---------- AR Session Ende Cleanup ---------- */
export function stopRecordingOnARSessionEnd() {
  const btnRecord = document.getElementById('btn-record');
  const recInfo = document.getElementById('rec-info');
  if (btnRecord && recInfo) {
    if (simulatedRecordingId || isRecordingReal) {
      stopAllRecording(recInfo, btnRecord);
    }
  }
}
