// js/viewer.js
(async function() {
    const params = new URLSearchParams(window.location.search);
    const sceneId = params.get('scene');
    const baseOrigin = params.get('base');

    const mv = document.getElementById('mv');
    const poster = document.getElementById('poster');
    const errEl = document.getElementById('err');
    const startArBtn = document.getElementById('startAr');
    
    // UI-Elemente für die WebXR-Toolbar (müssen in viewer.html ergänzt werden)
    const arUi = document.getElementById('ar-ui');
    const btnMute = document.getElementById('btn-mute');
    const arAudio = document.getElementById('ar-audio'); 

    if (!sceneId || !baseOrigin) {
        showError('Fehler: Szene-ID oder Basis-URL fehlt.');
        return;
    }

    const sceneUrl = `${baseOrigin}/api/scenes/${sceneId}/scene.json`;

    function showError(message) {
        poster.style.display = 'none';
        mv.style.display = 'none';
        errEl.textContent = message;
        errEl.style.display = 'block';
    }

    // --- 1. Konfiguration laden ---
    let sceneConfig;
    try {
        const res = await fetch(sceneUrl);
        if (!res.ok) throw new Error(`Status ${res.status}`);
        sceneConfig = await res.json();
    } catch (e) {
        showError(`Fehler beim Laden der Szene ${sceneId}: ${e.message}`);
        return;
    }

    const modelAsset = sceneConfig.model;
    if (!modelAsset || !modelAsset.url) {
        showError('Fehler: Hauptmodell (GLB) in Konfiguration fehlt.');
        return;
    }

    // Die Asset-URLs auf den Proxy umstellen
    const modelUrl = `${baseOrigin}/api/scenes/${sceneId}/${modelAsset.url}`;
    
    // --- 2. model-viewer konfigurieren ---
    mv.src = modelUrl;
    mv.ar = true;
    mv.arModes = "webxr scene-viewer quick-look"; // Wichtig für Plattform-Switch
    mv.cameraControls = true;
    mv.autoplay = true;
    mv.alt = sceneConfig.meta?.title || 'AR Scene';
    mv.loading = 'eager';
    
    // --- 3. Audio-Initialisierung (WebXR) ---
    let isMuted = localStorage.getItem('arMuted') === 'true';

    if (sceneConfig.audio && arAudio && btnMute) {
        const audioCfg = sceneConfig.audio;
        const audioFileUrl = `${baseOrigin}/api/scenes/${sceneId}/${audioCfg.url}`;
        
        arAudio.src = audioFileUrl;
        arAudio.loop = audioCfg.loop || false;
        arAudio.volume = audioCfg.volume || 0.8;
        arAudio.muted = isMuted;

        btnMute.textContent = isMuted ? '🔇 Unmute' : '🔊 Mute';
        
        // Audio beim AR-Start abspielen (WebXR)
        mv.addEventListener('ar-status', (e) => {
            if (e.detail.status === 'session-started' && e.detail.sessionKind === 'immersive-ar') {
                arUi.style.display = 'grid'; // WebXR UI zeigen
                const delayMs = (audioCfg.delaySeconds || 0) * 1000;
                // Timeout, um Delay zu implementieren (wie in Aero)
                setTimeout(() => {
                    if (!isMuted) {
                        arAudio.play().catch(err => console.warn("Audio Autoplay blockiert. ", err));
                    }
                }, delayMs);
            } else if (e.detail.status === 'not-presenting') {
                arUi.style.display = 'none'; // WebXR UI verstecken
                arAudio.pause();
                arAudio.currentTime = 0; // Reset
            }
        });

        // Mute-Funktion
        btnMute.addEventListener('click', () => {
            isMuted = !isMuted;
            arAudio.muted = isMuted;
            btnMute.textContent = isMuted ? '🔇 Unmute' : '🔊 Mute';
            localStorage.setItem('arMuted', isMuted);
            // Versuch, bei Unmute sofort abzuspielen, falls es blockiert war
            if (!isMuted && arAudio.paused) {
                 arAudio.play().catch(e => console.warn("Manuelles Play fehlgeschlagen", e));
            }
        });
    }


    // --- 4. Interaktive Buttons (Klick-Logik) ---
    const clickableNodes = sceneConfig.clickableNodes || [];
    
    if (clickableNodes.length > 0) {
        mv.addEventListener('click', (event) => {
            // Checken, ob ein 3D-Objekt im Model-Viewer getroffen wurde
            if (!event.detail.modelHit) return;
            
            // Abrufen der Namen der getroffenen THREE.js Nodes
            const hitNodes = mv.getHitNodes();
            
            for (const nodeName of hitNodes) {
                // Suchen nach einer passenden Konfiguration (Editor speichert den Namen)
                const config = clickableNodes.find(n => n.label === nodeName);
                
                if (config && config.url) {
                    // WICHTIG: window.open(url, '_blank') ist Best Practice für externe Links
                    console.log('Klick auf interaktives Objekt:', nodeName, '->', config.url);
                    window.open(config.url, '_blank');
                    
                    // Stoppen nach dem ersten Fund
                    return; 
                }
            }
        });
    }

    // --- 5. Start-Button Logik ---
    startArBtn.addEventListener('click', () => {
        mv.activateAR(); // Startet den passenden AR-Modus (WebXR/Quick Look/Scene Viewer)
        poster.style.display = 'none';
        // Bei Quick Look/Scene Viewer geht die Kontrolle an das System.
        // Bei WebXR wird ar-status='session-started' gefeuert (siehe oben).
    });

    // Poster nach dem Laden verstecken (falls AR-Session fehlschlägt/beendet wird)
    mv.addEventListener('load', () => {
        poster.style.opacity = '0';
        poster.style.transition = 'opacity 0.5s';
        setTimeout(() => { poster.style.display = 'none'; }, 500);
    });

})();
