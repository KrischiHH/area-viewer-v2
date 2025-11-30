// js/viewer.js

// Hilfsfunktion zum Abrufen der URL-Parameter
function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    return {
        sceneId: params.get('scene'),
        base: params.get('base'),
    };
}

// Hauptfunktion zum Laden und Konfigurieren der Szene
async function loadScene() {
    const { sceneId, base } = getUrlParams();
    
    if (!sceneId || !base) {
        console.error('Fehlende URL-Parameter: scene und base sind erforderlich.');
        return;
    }

    const sceneUrl = `${base}/scene/${sceneId}/scene.json`;

    try {
        const response = await fetch(sceneUrl);
        if (!response.ok) {
            throw new Error(`HTTP-Fehler! Status: ${response.status}`);
        }
        const sceneConfig = await response.json();
        console.log('Szene-Konfiguration geladen:', sceneConfig);

        configureViewer(sceneConfig, base, sceneId);
    } catch (error) {
        console.error('Fehler beim Laden der Szene-Konfiguration:', error);
    }
}

// Funktion zur Konfiguration des model-viewer und Audio
function configureViewer(config, base, sceneId) {
    const arSceneElement = document.getElementById('ar-scene');
    
    // Der finale GLB-Pfad
    const glbUrl = config.model && config.model.url 
      ? `${base}/scene/${sceneId}/${config.model.url}` 
      : '';

    if (!glbUrl) {
        console.error('Keine gültige Modell-URL in der Konfiguration gefunden.');
        return;
    }

    // Setzt die Quelle des Modells
    arSceneElement.setAttribute('src', glbUrl);
    
    // Setzt AR-Attribute, um den AR-Button zu aktivieren
    arSceneElement.setAttribute('ar-status-mode', 'entered'); // Zeigt den AR-Button an
    arSceneElement.setAttribute('ar', '');

    // Holt die model-viewer Instanz aus dem Shadow DOM
    // Muss gewartet werden, bis das Custom Element initialisiert ist
    arSceneElement.addEventListener('load', () => {
        const modelViewer = arSceneElement.shadowRoot.querySelector('model-viewer');

        if (modelViewer) {
            // NEU: Y-Offset anwenden (Anti-Schwebe-Fix)
            if (config.model && typeof config.model.yOffset === 'number') {
                // Konvertiert den Meter-Offset in eine CSS-Variable für das model-viewer Custom Element
                const yOffsetCSS = `${-config.model.yOffset}m`;
                modelViewer.style.setProperty('--ar-scale-device-height', yOffsetCSS);
                console.log(`Y-Offset-Korrektur angewendet: ${yOffsetCSS}`);
            }
            
            // NEU: Animationen starten
            modelViewer.setAttribute('autoplay', '');

            // NEU: Clickable Nodes Konfiguration
            if (config.clickableNodes && Array.isArray(config.clickableNodes)) {
                // ACHTUNG: Die Logik für klickbare Nodes erfordert möglicherweise detailliertere 
                // Implementierung im area-webar-scene, aber hier ist die Konfiguration:
                const annotationData = config.clickableNodes.map(node => ({
                    // Wir nehmen den Namen als "node" an
                    name: node.label, 
                    content: `<a href="${node.url}" target="_blank">Link: ${node.label}</a>`,
                    // Pin-Position auf dem Bildschirm (zum Beispiel in der Mitte)
                    position: "0.5 0.5 0.5" 
                }));
                // modelViewer.setAttribute('annotations', JSON.stringify(annotationData));
            }
        }
    });
    
    // NEU: Audio-Konfiguration
    if (config.audio && config.audio.url) {
        setupAudio(config.audio, base, sceneId);
    }
}

// Funktion zur Konfiguration des Audio-Players
function setupAudio(audioConfig, base, sceneId) {
    const audioControls = document.getElementById('audio-controls');
    const audioButton = document.getElementById('audio-button');
    
    // Setze die Audio-Steuerung sichtbar
    audioControls.style.display = 'block';

    // Pfad zur Audio-Datei
    const audioUrl = `${base}/scene/${sceneId}/${audioConfig.url}`;

    const audio = new Audio(audioUrl);
    audio.loop = audioConfig.loop || false;
    audio.volume = audioConfig.volume || 0.8;

    let isPlaying = false;

    // Startet die Wiedergabe nach Verzögerung
    const startAudio = () => {
        if (isPlaying) return;
        
        // DelaySeconds anwenden
        const delayMs = (audioConfig.delaySeconds || 0) * 1000;
        
        setTimeout(() => {
            audio.play().then(() => {
                isPlaying = true;
                audioButton.textContent = '🔇'; // Wird gespielt
            }).catch(e => {
                console.error('Audio-Wiedergabe fehlgeschlagen (evtl. User-Interaktion erforderlich):', e);
                // In diesem Fall bleibt es bei 🔊, da es nicht automatisch spielen konnte
            });
        }, delayMs);
    };

    // Umschalten der Wiedergabe bei Klick
    audioButton.addEventListener('click', () => {
        if (isPlaying) {
            audio.pause();
            isPlaying = false;
            audioButton.textContent = '🔊'; // Pausiert
        } else {
            // Starte Audio sofort, falls kein Delay gesetzt ist
            if (!audioConfig.delaySeconds) {
                audio.play().catch(e => console.error(e));
                // Der Rest der Logik wird von startAudio nach dem Delay/Play-Versuch übernommen
            }
            startAudio();
        }
    });

    // Startet die Audio-Wiedergabe, sobald AR aktiviert wird
    const arSceneElement = document.getElementById('ar-scene');
    arSceneElement.addEventListener('ar-status', (event) => {
        if (event.detail.status === 'entered') {
            startAudio();
        }
        if (event.detail.status === 'exited') {
            audio.pause();
            isPlaying = false;
            audioButton.textContent = '🔊';
        }
    });

    // Erneutes Starten des Audio nach Ende (falls Loop aktiv)
    audio.addEventListener('ended', () => {
        if (audio.loop) {
            audio.currentTime = 0;
            startAudio();
        } else {
            isPlaying = false;
            audioButton.textContent = '🔊';
        }
    });
    
    // Starte Audio beim Laden der Seite (falls der Browser es erlaubt)
    loadAudio(audio, startAudio);
}

// Fügt eine Funktion hinzu, um den Play-Versuch beim Laden zu kapseln
function loadAudio(audio, startAudio) {
    const arSceneElement = document.getElementById('ar-scene');
    arSceneElement.addEventListener('load', () => {
        startAudio();
    });
}


// Start
document.addEventListener('DOMContentLoaded', loadScene);
