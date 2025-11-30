// @ts-check

/**
 * Holt die Szene-Konfiguration von der Worker-Basis-URL.
 * @param {string} sceneId
 * @param {string} workerBase
 * @returns {Promise<any>}
 */
async function loadSceneConfig(sceneId, workerBase) {
    // KORRIGIERTER PFAD: Einheitlich /scenes/ (Plural) verwenden, um mit dem Worker-Routing übereinzustimmen.
    const sceneConfigUrl = `${workerBase}/scenes/${sceneId}/scene.json`;
    
    // Die fetchWithTimeout-Funktion muss aus publish-utils.js im Viewer verfügbar sein.
    // Wir setzen einen konservativen Timeout für die Konfigurationsdatei.
    const config = await fetchWithTimeout(sceneConfigUrl, {}, 15000)
        .then(res => {
            if (!res.ok) {
                throw new Error(`Fehler beim Laden der Szene-Konfiguration: ${res.status} ${res.statusText}`);
            }
            return res.json();
        })
        .catch(error => {
            console.error("Ladefehler für Scene-Config:", error);
            throw new Error(`Konfigurationsdatei nicht gefunden oder Netzwerkfehler: ${error.message}`);
        });

    return config;
}

/**
 * Initialisiert und konfiguriert das <model-viewer>-Element.
 * @param {string} sceneId
 * @param {string} workerBase
 */
async function initializeViewer(sceneId, workerBase) {
    let config;
    try {
        config = await loadSceneConfig(sceneId, workerBase);
    } catch (error) {
        document.getElementById('loading-status').textContent = `Fehler: ${error.message}`;
        return;
    }

    const arSceneElement = document.getElementById('ar-scene-element');
    
    // Überprüfe, ob das Element vom Typ model-viewer ist
    if (!arSceneElement || arSceneElement.tagName !== 'MODEL-VIEWER') {
        document.getElementById('loading-status').textContent = 'Fehler: Model-Viewer Element nicht gefunden oder falsch.';
        return;
    }

    // Setze die grundlegenden Attribute basierend auf der Konfiguration
    const modelUrl = `${workerBase}/scenes/${sceneId}/${config.model.url}`;
    
    // Setze das Quellmodell
    arSceneElement.setAttribute('src', modelUrl);

    // Setze die AR-Attribute
    arSceneElement.setAttribute('ar', 'true');
    arSceneElement.setAttribute('ar-modes', 'webxr scene-viewer quick-look');
    arSceneElement.setAttribute('camera-controls', 'true');
    arSceneElement.setAttribute('alt', config.model.alt || 'Ein 3D-Modell, das in AR betrachtet werden kann.');
    arSceneElement.setAttribute('loading', 'eager');
    arSceneElement.setAttribute('shadow-intensity', '1');
    arSceneElement.setAttribute('auto-rotate', 'true'); // Füge eine einfache Rotation hinzu, um das Laden zu signalisieren

    // Weitere Attribute aus der Konfiguration übernehmen (falls vorhanden)
    if (config.environmentImage) {
        arSceneElement.setAttribute('environment-image', config.environmentImage);
    }
    if (config.exposure) {
        arSceneElement.setAttribute('exposure', config.exposure);
    }
    if (config.shadowSoftness) {
        arSceneElement.setAttribute('shadow-softness', config.shadowSoftness);
    }

    // Hotspot-Konfiguration (vereinfacht für model-viewer)
    if (config.annotationData && Array.isArray(config.annotationData)) {
        config.annotationData.forEach(annotation => {
            if (annotation.position && annotation.content) {
                // Erstellen eines Hotspot-Elements
                const hotspot = document.createElement('button');
                hotspot.setAttribute('slot', `hotspot-${annotation.label}`); // Verwenden Sie Label als eindeutigen Hotspot-Namen
                hotspot.setAttribute('data-position', `${annotation.position.x} ${annotation.position.y} ${annotation.position.z}`);
                hotspot.setAttribute('data-normal', `${annotation.normal ? annotation.normal.x + ' ' + annotation.normal.y + ' ' + annotation.normal.z : '0 0 1'}`);
                hotspot.setAttribute('class', 'Hotspot');

                // Füge den Inhalt hinzu (z.B. ein Link)
                hotspot.innerHTML = annotation.content;
                
                arSceneElement.appendChild(hotspot);
            }
        });
    }

    // Entfernen des Lade-Status und Anzeigen des AR-Elements
    document.getElementById('loading-status').style.display = 'none';
    document.getElementById('ar-container').style.display = 'block';
    
    // Event-Listener für das erfolgreiche Laden des Modells
    arSceneElement.addEventListener('load', () => {
        console.log('3D-Modell erfolgreich geladen.');
        // Entferne die automatische Rotation, sobald das Modell geladen ist
        arSceneElement.removeAttribute('auto-rotate'); 
    });
    
    // Fehlerbehandlung
    arSceneElement.addEventListener('error', (e) => {
        console.error('model-viewer Ladefehler:', e);
        document.getElementById('loading-status').textContent = 'Fehler beim Laden des 3D-Modells. URL oder Format falsch.';
        document.getElementById('loading-status').style.display = 'block';
        document.getElementById('ar-container').style.display = 'none';
    });


    // --- AR-Modus Start ---
    const arButton = document.getElementById('ar-button');
    if (arButton) {
        arButton.addEventListener('click', () => {
            // Starte den AR-Modus programmatisch, falls das native <button slot="ar-button"> nicht funktioniert.
            // Der model-viewer sollte das automatisch übernehmen, wenn das 'ar'-Attribut gesetzt ist.
            // Dies ist ein Fallback oder zusätzliche Logik.
            if (arSceneElement.hasAttribute('ar-status') && arSceneElement.getAttribute('ar-status') === 'not-presenting') {
                 arSceneElement.activateAR();
            } else {
                // Das AR-Attribut reicht meistens aus, um den Button zu aktivieren.
                // Wir lassen das dem model-viewer über.
                console.log('AR-Aktivierung über model-viewer Button erwartet.');
            }
        });
    }

    // --- AR-Modus Skalierung/Korrektur (wie im Bericht erwähnt) ---
    // model-viewer unterstützt diese CSS-Variable nicht offiziell. Die Lösung ist, die 
    // Skalierung und Positionierung dem AR-Core/AR-Kit überlassen.
    // Wenn das Modell bewegungslos ist, liegt es meistens daran, dass das Gerät nicht
    // in der Lage ist, die Oberfläche zu erkennen (Tracking fehlt).
    
    // Die beste Methode ist, das 'scale'-Attribut zu verwenden, um das Modell initial zu verkleinern,
    // falls es zu groß ist. Wir lassen es hier standardmäßig auf auto.

    // Wenn der AR-Modus erfolgreich gestartet wird (für Debugging):
    arSceneElement.addEventListener('ar-status', (event) => {
        if (event.detail.status === 'error') {
            console.error('AR-Fehler:', event.detail.message);
            alert(`AR-Fehler: ${event.detail.message}. Stellen Sie sicher, dass Ihr Gerät ARCore/ARKit unterstützt und die Kamera aktiv ist.`);
        }
        if (event.detail.status === 'session-started') {
            console.log('AR-Sitzung erfolgreich gestartet.');
        }
    });
}

// Global verfügbare Helferfunktion (aus publish-utils.js)
// Notwendig, da der Viewer nicht alle externen Module über einen Build-Schritt zieht.
function fetchWithTimeout(url, options = {}, timeoutMs = 20000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);

    const fullOptions = {
        ...options,
        signal: controller.signal
    };

    return fetch(url, fullOptions)
        .finally(() => {
            clearTimeout(id);
        });
}


document.addEventListener('DOMContentLoaded', () => {
    // 1. URL-Parameter auslesen
    const params = new URLSearchParams(window.location.search);
    const sceneId = params.get('scene');
    const workerBase = params.get('base');

    if (!sceneId || !workerBase) {
        document.getElementById('loading-status').textContent = 'Fehler: Szene ID oder Worker-Basis-URL fehlt in den Parametern.';
        return;
    }

    // 2. Initialisierung starten
    initializeViewer(sceneId, workerBase);
});
