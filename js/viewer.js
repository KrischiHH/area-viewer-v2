// js/viewer.js

(() => {
    /********************
     * Utility & State  *
     ********************/
    const rawQuery = location.search;
    const qs = new URLSearchParams(rawQuery);
    // Falls prefer versehentlich an base hängt (…base=URL?prefer=web), trotzdem erkennen:
    if (!qs.get('prefer') && rawQuery.includes('prefer=web')) {
      qs.set('prefer', 'web');
    }
  
    const DEV = qs.has('dev');
    const prefer = qs.get('prefer'); // 'web' → WebXR zuerst
    const forceWebxr = qs.has('forceWebxr');
    const debugTrace = qs.has('debugTrace');
    const debugUi = qs.has('debugUi');
  
    const mv = document.getElementById('mv');
    const errBox = document.getElementById('err');
  
    const poster = document.getElementById('poster');
    const posterTitle = document.getElementById('posterTitle');
    const posterDesc = document.getElementById('posterDesc');
    const posterImage = document.getElementById('posterImage');
    const startBtn = document.getElementById('startAr');
  
    const arUi = document.getElementById('ar-ui');
    const btnShutter = document.getElementById('btn-shutter');
    const btnGallery = document.getElementById('btn-gallery');
    const recInfo = document.getElementById('rec-info');
    const recTime = document.getElementById('rec-time');
    const captureStatus = document.getElementById('captureStatus');
    const screenFlash = document.getElementById('screen-flash');
    
    // NEU: Mute-Button (wird dynamisch erzeugt oder muss im HTML ergänzt werden)
    // Wir fügen ihn programmatisch zur Toolbar hinzu, um HTML-Änderungen gering zu halten
    let btnMute = null; 
  
    const debugOverlay = document.getElementById('debug-overlay');
    if (debugTrace && debugOverlay) debugOverlay.style.display = 'block';
  
    let audioEl = null;
    let audioCfg = null;
    let isMuted = localStorage.getItem('arMuted') === 'true'; // Status laden
  
    // AR-Modus-Reihenfolge
    if (forceWebxr) {
      mv.setAttribute('ar-modes', 'webxr');
    } else if (prefer === 'web') {
      mv.setAttribute('ar-modes', 'webxr scene-viewer quick-look');
    } else {
      mv.setAttribute('ar-modes', 'scene-viewer quick-look webxr'); // Standard: nativ zuerst
    }
  
    function showError(msg) { 
        errBox.textContent = msg; 
        errBox.style.display = 'block'; 
        console.error('[viewer]', msg); 
    }
    function hideError() { errBox.style.display = 'none'; }
    function bust(u) { if (!DEV || !u) return u; const sep = u.includes('?') ? '&' : '?'; return u + sep + 'v=' + Date.now(); }
  
    // Diagnose
    const diag = {
      xrSupported: !!navigator.xr,
      immersiveArSupported: null,
      arModes: mv.getAttribute('ar-modes'),
      sessionStarted: false,
      fallbackTimerTriggered: false,
      modeExplanation: '',
      audio: 'none',
      videoSupported: !!(HTMLCanvasElement.prototype.captureStream) && typeof MediaRecorder !== 'undefined',
      canvasStream: null
    };
    window.__AREA_DIAG = diag;
    window.__dumpAreaDiag = () => console.table(diag);
    
    function updateOverlay() {
      if (!debugTrace || !debugOverlay) return;
      debugOverlay.innerHTML =
  `<strong>AR-Diagnose</strong>
  xrSupported: ${diag.xrSupported}
  immersive-ar: ${diag.immersiveArSupported}
  ar-modes: ${diag.arModes}
  sessionStarted: ${diag.sessionStarted}
  fallbackTimer: ${diag.fallbackTimerTriggered}
  videoSupported: ${diag.videoSupported}
  audio: ${diag.audio}
  modeNote: ${diag.modeExplanation}`;
    }
  
    if (navigator.xr?.isSessionSupported) {
      navigator.xr.isSessionSupported('immersive-ar')
        .then(s => { diag.immersiveArSupported = s; updateOverlay(); })
        .catch(_ => { diag.immersiveArSupported = false; updateOverlay(); });
    } else {
      diag.immersiveArSupported = false; updateOverlay();
    }
  
    // Scene/Config
    const defaultBase = 'https://area-publish.area-webar.workers.dev';
    const rawBase = (qs.get('base') || defaultBase);
    let workerBase = rawBase.split('"')[0].split(',')[0].trim()
      .replace(/\/scenes\/[^\/?#]+\/?$/, '')
      .replace(/\/+$/, '');
    if (!/^https?:\/\//i.test(workerBase)) workerBase = defaultBase;
  
    const sceneId = (qs.get('scene') || qs.get('src') || '').trim();
    const overrideGlb = (qs.get('glb') || '').trim();
    const overrideUsdz = (qs.get('usdz') || '').trim();
    
    const isHttp = (u) => /^https?:\/\//i.test(u);
    const isDataOrBlob = (u) => u.startsWith('data:') || u.startsWith('blob:');
    let SCENE_GLB = ''; 
    let SCENE_JSON = '';
  
    if (overrideGlb) SCENE_GLB = overrideGlb;
    if (sceneId) {
      if (isHttp(sceneId)) {
        if (sceneId.toLowerCase().match(/\.(glb|gltf)$/)) { 
            if (!SCENE_GLB) SCENE_GLB = sceneId; 
        } else { 
            SCENE_JSON = sceneId; 
        }
      } else {
        const id = sceneId.replace(/\/+$/, '');
        if (!SCENE_GLB) SCENE_GLB = `${workerBase}/scenes/${encodeURIComponent(id)}/scene.glb`;
        SCENE_JSON = `${workerBase}/scenes/${encodeURIComponent(id)}/scene.json`;
      }
    }
  
    const cfg = {
      glbUrl: SCENE_GLB || "https://modelviewer.dev/shared-assets/models/Astronaut.glb",
      usdzUrl: null,
      meta: { title: null, description: null },
      welcome: { title: null, desc: null, posterFile: null },
      clickableNodes: [] // NEU: Speicher für Klick-Logik
    };
  
    async function headOk(url) {
      try { const r = await fetch(bust(url), { method: 'HEAD', cache: 'no-cache' }); return r.ok; }
      catch { return false; }
    }
    function resolveRel(u) {
      if (!u) return '';
      if (/^https?:\/\//i.test(u) || u.startsWith('data:')) return u;
      if (!sceneId) return u;
      return `${workerBase}/scenes/${encodeURIComponent(sceneId)}/${u}`;
    }
  
    // --- LOAD SCENE ---
    (async () => {
      try {
        if (SCENE_JSON && !isDataOrBlob(SCENE_JSON)) {
          const r = await fetch(bust(SCENE_JSON), { cache: 'no-cache' });
          if (!r.ok) throw new Error('scene.json: ' + r.status + ' ' + r.statusText);
          const j = await r.json();
  
          if (j.meta) { cfg.meta.title = j.meta.title || null; cfg.meta.description = j.meta.description || null; }
          if (j.model && j.model.url && !overrideGlb) { cfg.glbUrl = resolveRel(j.model.url); SCENE_GLB = cfg.glbUrl; }
          if (j.model && j.model.usdzUrl && !overrideUsdz) { cfg.usdzUrl = resolveRel(j.model.usdzUrl); }
          
          if (j.ui && j.ui.welcome) {
            cfg.welcome.title = j.ui.welcome.title || null;
            cfg.welcome.desc = j.ui.welcome.desc || null;
            cfg.welcome.posterFile = j.ui.welcome.poster || null;
          }
          
          // NEU: Klickbare Nodes laden
          if (j.clickableNodes && Array.isArray(j.clickableNodes)) {
              cfg.clickableNodes = j.clickableNodes;
          }

          if (j.audio && j.audio.url) {
            audioCfg = {
              url: resolveRel(j.audio.url),
              loop: !!j.audio.loop,
              delaySeconds: j.audio.delaySeconds || 0,
              volume: Math.min(1, Math.max(0, j.audio.volume ?? 0.8))
            };
            diag.audio = `pending load (${audioCfg.url})`;
            updateOverlay();
          }
        }
  
        posterTitle.textContent = cfg.meta.title || cfg.welcome.title || "ARea AR-Erlebnis";
        posterDesc.textContent = cfg.meta.description || cfg.welcome.desc ||
          "Tippe auf „AR starten“, richte dein Gerät auf eine ebene Fläche und platziere dann das 3D-Modell.";
  
        if (cfg.welcome.posterFile && sceneId) {
          const posterUrl = `${workerBase}/scenes/${encodeURIComponent(sceneId)}/${encodeURIComponent(cfg.welcome.posterFile)}`;
          posterImage.src = bust(posterUrl);
          posterImage.style.display = 'block';
        }
  
        const finalGlb = SCENE_GLB || cfg.glbUrl;
        if (finalGlb && !(await headOk(finalGlb))) {
          showError('GLB nicht gefunden: ' + finalGlb);
        }
        mv.src = bust(finalGlb);
  
        const finalUsdz = overrideUsdz || cfg.usdzUrl || null;
        if (finalUsdz) mv.setAttribute('ios-src', finalUsdz);
        else mv.removeAttribute('ios-src');
  
        // AUDIO SETUP
        if (audioCfg) {
          audioEl = new Audio();
          audioEl.src = bust(audioCfg.url);
          audioEl.loop = audioCfg.loop;
          audioEl.volume = audioCfg.volume;
          audioEl.muted = isMuted; // Status setzen
          audioEl.preload = 'auto';
          audioEl.crossOrigin = 'anonymous';
          audioEl.addEventListener('canplay', () => { diag.audio = 'loaded'; updateOverlay(); });
          audioEl.addEventListener('error', () => { diag.audio = 'error'; updateOverlay(); });
          
          // Mute Button erzeugen, falls Audio da ist
          createMuteButton();
        }
        updateOverlay();
  
      } catch (e) {
        showError('Szene konnte nicht geladen werden: ' + e.message);
        console.error(e);
      }
    })();
  
    // --- Helper: Mute Button dynamisch einfügen ---
    function createMuteButton() {
        const toolbar = document.querySelector('#ar-ui .bottom-bar') || document.querySelector('#ar-ui .toolbar');
        if (!toolbar) return;
        
        // Verhindern, dass er doppelt erzeugt wird
        if (document.getElementById('btn-mute')) return;

        btnMute = document.createElement('button');
        btnMute.id = 'btn-mute';
        btnMute.className = 'ar-btn'; // Nutzt bestehende CSS Klasse
        btnMute.style.marginRight = '10px';
        btnMute.textContent = isMuted ? '🔇' : '🔊';
        
        btnMute.addEventListener('click', () => {
            isMuted = !isMuted;
            if (audioEl) audioEl.muted = isMuted;
            localStorage.setItem('arMuted', isMuted);
            btnMute.textContent = isMuted ? '🔇' : '🔊';
            // Versuchen abzuspielen bei Unmute
            if (!isMuted && audioEl && audioEl.paused && diag.sessionStarted) {
                audioEl.play().catch(e => console.warn('Unmute play failed', e));
            }
        });

        // Vor dem Shutter einfügen
        if (btnShutter) {
            toolbar.insertBefore(btnMute, btnShutter);
        } else {
            toolbar.appendChild(btnMute);
        }
    }

    // Sicherer Play-Aufruf für Animation
    mv.addEventListener('load', () => {
      const names = mv.availableAnimations || [];
      if (names && names.length) {
        mv.animationName = names[0];
        try {
          const ret = mv.play && mv.play();
          if (ret && typeof ret.catch === 'function') {
            ret.catch(e => console.warn('play failed', e));
          }
        } catch (e) {
          console.warn('play failed (sync)', e);
        }
      }
    });
  
    // NEU: CLICK EVENT FÜR INTERAKTIVE URLS
    mv.addEventListener('click', (event) => {
        // Nur feuern, wenn ein Modell getroffen wurde und wir Configs haben
        if (!event.detail.modelHit || !cfg.clickableNodes || cfg.clickableNodes.length === 0) return;
        
        const hitNodes = mv.getHitNodes();
        
        // Prüfen ob einer der getroffenen Nodes in unserer Config ist
        for (const nodeName of hitNodes) {
            const nodeCfg = cfg.clickableNodes.find(n => n.label === nodeName);
            if (nodeCfg && nodeCfg.url) {
                console.log(`Klick auf ${nodeName}, öffne ${nodeCfg.url}`);
                window.open(nodeCfg.url, '_blank');
                return; // Ersten Treffer nehmen
            }
        }
    });

    // AR-Status
    let arStatusFallbackTimer = null;
    mv.addEventListener('ar-status', e => {
      if (arStatusFallbackTimer) { clearTimeout(arStatusFallbackTimer); arStatusFallbackTimer = null; }
      
      if (e.detail.status === 'session-started') {
        diag.sessionStarted = true;
        arUi.style.display = 'block'; // Zeigt UI inkl. Shutter & Mute
        
        // Audio Start
        if (audioEl && !isMuted) {
          const delayMs = Math.max(0, (audioCfg?.delaySeconds || 0) * 1000);
          setTimeout(() => audioEl.play().catch(err => console.warn("Autoplay audio blocked", err)), delayMs);
        }
      } else if (e.detail.status === 'not-presenting') {
        diag.sessionStarted = false;
        arUi.style.display = 'none';
        poster.style.display = 'flex';
        
        // Audio Stop
        if (audioEl) {
            audioEl.pause();
            audioEl.currentTime = 0;
        }
        stopVideoRecording(false);
      }
      updateOverlay();
    });
  
    // Start-Button
    startBtn.addEventListener('click', async ev => {
      ev.preventDefault(); ev.stopPropagation(); hideError();
      startBtn.disabled = true;
      try {
        const arFn = mv.activateAR || mv.enterAR;
        if (typeof arFn !== 'function') throw new Error('AR-Funktion nicht verfügbar.');
        await arFn.call(mv);
        poster.style.display = 'none';
  
        // Fallback: Falls ar-status nicht kommt (z. B. nativer Handoff)
        arStatusFallbackTimer = setTimeout(() => {
          if (arUi.style.display === 'none') {
            diag.fallbackTimerTriggered = true;
            diag.modeExplanation = 'Kein session-started → evtl. nativer Fallback';
            updateOverlay();
          }
        }, 1500);
  
        // Audio Versuch (falls WebXR sofort da ist)
        if (audioEl && !diag.sessionStarted && !isMuted) {
          const delayMs = Math.max(0, (audioCfg?.delaySeconds || 0) * 1000);
          setTimeout(() => audioEl.play().catch(() => {}), delayMs);
        }
      } catch (e) {
        showError('AR konnte nicht gestartet werden: ' + e.message);
        poster.style.display = 'flex';
      } finally {
        startBtn.disabled = false;
        updateOverlay();
      }
    });
  
    // Debug-UI (Optional)
    if (debugUi && arUi) {
      poster.style.display = 'none';
      arUi.style.display = 'block';
      console.warn('[debugUi] AR-UI erzwungen ohne AR-Session');
    }
  
    // Galerie öffnen / Teilen
    let lastCaptureUrl = null;
    let lastCaptureBlob = null;
    let lastCaptureName = null;
    let lastCaptureMime = null;
  
    if (btnGallery) {
        btnGallery.addEventListener('click', async () => {
        if (!lastCaptureBlob) { flashStatus('Noch keine Aufnahme'); return; }
        const canShareFile = !!navigator.share && !!navigator.canShare &&
            navigator.canShare({ files: [new File([lastCaptureBlob], lastCaptureName || 'capture', { type: lastCaptureMime || 'application/octet-stream' })] });
        if (canShareFile) {
            try {
            await navigator.share({
                files: [new File([lastCaptureBlob], lastCaptureName, { type: lastCaptureMime })],
                title: 'ARea Aufnahme'
            });
            return;
            } catch (e) { /* abgebrochen */ }
        }
        window.open(lastCaptureUrl, '_blank');
        });
    }
  
    // Capture Utils
    function getCanvas() { return mv.shadowRoot?.querySelector('canvas') || document.querySelector('canvas'); }
    function flashStatus(msg) {
      if (!captureStatus) return;
      captureStatus.textContent = msg;
      captureStatus.style.display = 'block';
      clearTimeout(captureStatus._t);
      captureStatus._t = setTimeout(() => captureStatus.style.display = 'none', 1800);
    }
    function flashScreen() {
      if (!screenFlash) return;
      screenFlash.classList.remove('flash-active'); void screenFlash.offsetWidth;
      screenFlash.classList.add('flash-active');
    }
    function blinkShutter() {
      if (!btnShutter) return;
      btnShutter.classList.remove('snap'); void btnShutter.offsetWidth;
      btnShutter.classList.add('snap');
    }
    function downloadBlob(url, name) {
      const a = document.createElement('a');
      a.download = name; a.href = url;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    }
  
    // Screenshot
    async function takeScreenshot() {
      if (!diag.sessionStarted) { flashStatus('AR nicht aktiv'); return; }
      blinkShutter(); flashScreen();
  
      const canvas = getCanvas();
      if (!canvas) { flashStatus('Kein Canvas'); return; }
      const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
      if (!blob) { flashStatus('Screenshot fehlgeschlagen'); return; }
  
      const url = URL.createObjectURL(blob);
      lastCaptureUrl = url;
      lastCaptureBlob = blob;
      lastCaptureMime = 'image/png';
      lastCaptureName = 'area-ar-' + Date.now().toString(36) + '.png';
  
      if (btnGallery) {
        btnGallery.innerHTML = '';
        const img = document.createElement('img');
        img.src = url;
        btnGallery.appendChild(img);
      }
  
      downloadBlob(url, lastCaptureName);
      flashStatus('Screenshot gespeichert');
    }
  
    // Video
    let recording = false, mediaRecorder = null, recordedChunks = [], longPressT = null;
  
    function pickBestMime() {
      const order = [
        'video/mp4;codecs="avc1.42E01E,mp4a.40.2"',
        'video/mp4;codecs="h264,mp4a.40.2"',
        'video/mp4',
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm'
      ];
      for (const t of order) {
        try { if (MediaRecorder.isTypeSupported(t)) return t; } catch {}
      }
      return '';
    }
  
    function startVideoRecording() {
      if (recording) return;
      if (!diag.sessionStarted) { flashStatus('AR nicht aktiv'); return; }
      const canvas = getCanvas();
      if (!canvas || !canvas.captureStream) { flashStatus('Video nicht unterstützt'); return; }
      const stream = canvas.captureStream(30);
  
      const mimeType = pickBestMime();
      try { mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream); }
      catch (e) {
        try { mediaRecorder = new MediaRecorder(stream); }
        catch (_) { flashStatus('MediaRecorder fehlt'); return; }
      }
  
      recordedChunks = [];
      mediaRecorder.ondataavailable = ev => { if (ev.data && ev.data.size > 0) recordedChunks.push(ev.data); };
      mediaRecorder.onstop = async () => {
        if (!recordedChunks.length) { flashStatus('Keine Videodaten'); return; }
        const type = recordedChunks[0]?.type || (mimeType || 'video/webm');
        const blob = new Blob(recordedChunks, { type });
        const url = URL.createObjectURL(blob);
        lastCaptureUrl = url;
        lastCaptureBlob = blob;
        lastCaptureMime = type;
        const ext = type.includes('mp4') ? '.mp4' : '.webm';
        lastCaptureName = 'area-ar-video-' + Date.now().toString(36) + ext;
  
        if (ext === '.webm' && /iPad|iPhone|iPod/.test(navigator.userAgent)) {
          flashStatus('Hinweis: WEBM wird auf iOS evtl. nicht unterstützt');
        }
  
        if (btnGallery) btnGallery.innerHTML = '🎬';
  
        downloadBlob(url, lastCaptureName);
        flashStatus('Video gespeichert');
      };
  
      mediaRecorder.start();
      recording = true;
      if (btnShutter) btnShutter.classList.add('recording');
      flashStatus('Videoaufnahme gestartet');
    }
  
    function stopVideoRecording(showMsg = true) {
      if (!recording) return;
      try { mediaRecorder.stop(); } catch (_) {}
      recording = false;
      if (btnShutter) btnShutter.classList.remove('recording');
      if (showMsg) flashStatus('Videoaufnahme beendet');
    }
  
    // Shutter: Tap = Foto, Long-press = Video
    const LONG_PRESS_MS = 300;
    if (btnShutter) {
        btnShutter.addEventListener('pointerdown', (ev) => {
        ev.preventDefault();
        if (recording) return;
        longPressT = setTimeout(() => startVideoRecording(), LONG_PRESS_MS);
        });
        function cancelLongPressTimer() {
        if (longPressT) { clearTimeout(longPressT); longPressT = null; }
        }
        btnShutter.addEventListener('pointerup', (ev) => {
        ev.preventDefault();
        if (recording) {
            stopVideoRecording(true);
        } else {
            if (longPressT) { cancelLongPressTimer(); takeScreenshot(); }
        }
        });
        btnShutter.addEventListener('pointerleave', () => { if (!recording) cancelLongPressTimer(); });
    }
  
  })();
