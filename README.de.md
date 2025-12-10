# <h1 align="center">WhatsApp Backup Reader</h1>

<p align="center">
  <img src="src/lib/assets/favicon.svg" width="100" height="100" alt="WhatsApp Backup Reader" />
</p>

<p align="center">
  <strong>Durchsuchen Sie Ihre WhatsApp-Exporte offline. Ihre Daten bleiben auf Ihrem Gerät.</strong>
</p>

<p align="center">
  <a href="README.md">English</a> •
  <a href="README.pt.md">Português</a> •
  <a href="README.es.md">Español</a> •
  <a href="README.fr.md">Français</a> •
  <strong>Deutsch</strong>
</p>

---

## Beschreibung

Ziehen Sie eine exportierte WhatsApp `.zip`-Datei per Drag & Drop und durchsuchen Sie Ihre Nachrichten, Fotos und Sprachnachrichten. Funktioniert mit großen Chats (getestet mit über 10.000 Nachrichten).

Sprachnachrichten können mit [Whisper](https://openai.com/research/whisper) transkribiert werden, das in Ihrem Browser via WebGPU läuft. Kein Server, kein API-Schlüssel erforderlich.

## Funktionen

- **Sprachtranskription**: Audio mit Whisper transkribieren (läuft lokal, über 12 Sprachen)
- **Suche**: Volltextsuche in Nachrichten und Transkriptionen
- **Lesezeichen**: Nachrichten mit Notizen speichern, als JSON exportieren/importieren
- **Perspektivmodus**: Chat als beliebiger Teilnehmer anzeigen
- **Statistiken**: Nachrichtenzähler, Aktivitätsdiagramme, Zeitachse
- **Dunkler Modus**: Folgt dem System oder manuelles Umschalten
- **Mehrsprachige Oberfläche**: Englisch, Portugiesisch, Spanisch, Französisch, Deutsch, Italienisch, Niederländisch, Japanisch, Chinesisch, Russisch
- **Desktop-App**: macOS, Windows, Linux via Electron

## Schnellstart

### Voraussetzungen

Sie benötigen [Node.js](https://nodejs.org/) (Version 18 oder höher).

### App ausführen

```bash
npm install
npm run dev
```

Öffnen Sie [localhost:5173](http://localhost:5173) in Ihrem Browser und ziehen Sie Ihre WhatsApp `.zip`-Datei per Drag & Drop.

### Desktop-App (optional)

```bash
npm run electron:dev    # im Entwicklungsmodus ausführen
npm run electron:build  # Installer für Ihr Betriebssystem erstellen
```

## WhatsApp-Export

### iPhone
1. WhatsApp öffnen und zu einem Chat gehen
2. Auf Kontakt- oder Gruppennamen oben tippen
3. Nach unten scrollen und **Chat exportieren** tippen
4. **Medien einschließen** wählen
5. Datei speichern

### Android
1. WhatsApp öffnen und zu einem Chat gehen
2. Auf drei Punkte **⋮** oben rechts tippen
3. **Mehr** → **Chat exportieren** tippen
4. **Medien einschließen** wählen
5. `.zip`-Datei speichern

## Datenschutz und Sicherheit

Diese App ist auf Datenschutz ausgelegt. Ihre WhatsApp-Daten verlassen niemals Ihr Gerät.

- **100% Offline**: Funktioniert ohne Internet nach dem Laden
- **Lokale Verarbeitung**: Alles passiert in Ihrem Browser
- **Lokale KI**: Sprachtranskription via lokales WebGPU
- **Kein Tracking**: Null Analytik oder Telemetrie
- **Open Source**: Öffentlicher Code unter AGPL-3.0-Lizenz

## Erstellt mit

- [SvelteKit](https://kit.svelte.dev) + [Svelte 5](https://svelte.dev)
- [Tailwind CSS 4](https://tailwindcss.com)
- [Electron](https://electronjs.org)
- [Transformers.js](https://huggingface.co/docs/transformers.js)
- [JSZip](https://stuk.github.io/jszip/)

## Mitwirken

Bug oder Idee? [Issue öffnen](https://github.com/rodrigogs/whats-reader/issues) auf GitHub.

## Lizenz

[AGPL-3.0](LICENSE)
