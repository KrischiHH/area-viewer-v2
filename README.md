# AR Viewer

Ein mobiler AR-Viewer für GLB-Szenen aus Cloudflare, bereit für moderne Browser (Android/iOS mobil, Desktop möglich).  
**Nutzt A-Frame, AR.js, unterstützt Foto- und Videoaufnahme mit lokaler Galerie. Mehrsprachig.**

## Features

- GLB-Link über ?scene=... an URL (z. B. `...?scene=https://dein-storage/model.glb`)
- AR-Platzierung, -Rotation, -Skalierung, Surface Detection
- Animation & Audio (vorausgesetzt, beides ist im .glb enthalten und von Browser unterstützt)
- Fotoaufnahme, Videoaufnahme, Minigalerie (im Local Storage)
- Deutsch & Englisch (Sprachumschaltung)
- Cloudflare-kompatibel, statisches Hosting

## Deployment

Einfach als statisches Webprojekt auf Cloudflare, Netlify, Vercel, Github Pages hosten.
- Alle Dateien (außer README.md) ins Repo legen
- `lang/` für Übersetzungsdateien, alles wird clientseitig geladen
- GLB-Datei beim Aufruf übergeben:  
  `https://deine-seite.com/?scene=https://r2-bucket/model.glb`

## Lokale Entwicklung

Kein Build nötig – reicht ein Fileserver oder `python3 -m http.server`, dann per Browser aufrufen.
Galerie-Daten werden pro Session im Session Storage abgelegt.  

## Erweiterung

- Drag & Drop, Pinch/Zoom (via gesture-detector Plugin)
- Teilen-Optionen
- Mehrsprachigkeit ausbauen

## Lizenz

MIT
