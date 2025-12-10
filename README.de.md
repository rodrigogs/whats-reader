<h1 align="center">WhatsApp Backup Reader</h1>

<p align="center">
  <img src="src/lib/assets/favicon.svg" width="100" height="100" alt="WhatsApp Backup Reader" />
</p>

<p align="center">
  <strong>Durchsuchen Sie Ihre WhatsApp-Exporte offline. Ihre Daten bleiben auf Ihrem Gerät.</strong>
</p>

<p align="center">
  <a href="https://github.com/rodrigogs/whats-reader/releases/latest"><img src="https://img.shields.io/github/v/release/rodrigogs/whats-reader?style=flat-square&color=blue" alt="Latest Release" /></a>
  <a href="https://github.com/rodrigogs/whats-reader/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/rodrigogs/whats-reader/ci.yml?branch=dev&style=flat-square&label=CI" alt="CI Status" /></a>
  <a href="https://github.com/rodrigogs/whats-reader/blob/main/LICENSE"><img src="https://img.shields.io/github/license/rodrigogs/whats-reader?style=flat-square" alt="License" /></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Svelte-5-FF3E00?style=flat-square&logo=svelte&logoColor=white" alt="Svelte 5" />
  <img src="https://img.shields.io/badge/Electron-39-47848F?style=flat-square&logo=electron&logoColor=white" alt="Electron 39" />
  <img src="https://img.shields.io/badge/AI-Whisper_(local)-00A67E?style=flat-square&logo=openai&logoColor=white" alt="Local Whisper AI" />
  <img src="https://img.shields.io/badge/Privacy-100%25_offline-4CAF50?style=flat-square&logo=shield&logoColor=white" alt="100% Offline" />
</p>

<p align="center">
  <a href="README.md">English</a> •
  <a href="README.pt.md">Português</a> •
  <a href="README.es.md">Español</a> •
  <a href="README.fr.md">Français</a> •
  <strong>Deutsch</strong> •
  <a href="README.it.md">Italiano</a> •
  <a href="README.nl.md">Nederlands</a> •
  <a href="README.ja.md">日本語</a> •
  <a href="README.zh.md">中文</a> •
  <a href="README.ru.md">Русский</a>
</p>

<p align="center">
  <a href="#funktionen">Funktionen</a> •
  <a href="#schnellstart">Schnellstart</a> •
  <a href="#whatsapp-export">Export-Anleitung</a> •
  <a href="#datenschutz-und-sicherheit">Datenschutz</a> •
  <a href="#mitwirken">Mitwirken</a>
</p>

---

## Beschreibung

Ziehen Sie eine exportierte WhatsApp `.zip`-Datei per Drag & Drop und durchsuchen Sie Ihre Nachrichten, Fotos und Sprachnachrichten. Funktioniert mit großen Chats (getestet mit über 10.000 Nachrichten).

Sprachnachrichten können mit [Whisper](https://openai.com/research/whisper) transkribiert werden, das in Ihrem Browser via WebGPU läuft. Kein Server, kein API-Schlüssel erforderlich.

<details>
<summary>Screenshots</summary>
<br>

| Startbildschirm | Chat-Ansicht |
|:---:|:---:|
| <img src="examples/images/1-start.png" width="400" /> | <img src="examples/images/2-chats.png" width="400" /> |

| Chat-Optionen | Perspektivmodus |
|:---:|:---:|
| <img src="examples/images/3-chat-options.png" width="400" /> | <img src="examples/images/4-view-as.png" width="400" /> |

| Lesezeichen | Statistiken |
|:---:|:---:|
| <img src="examples/images/5-bookmarks.png" width="400" /> | <img src="examples/images/6-statistics.png" width="400" /> |

| Sprachtranskription |
|:---:|
| <img src="examples/images/7-audio-transcription.png" width="400" /> |

</details>

---

## Funktionen

- **Sprachtranskription**: Audio mit Whisper transkribieren (läuft lokal, über 12 Sprachen)
- **Suche**: Volltextsuche in Nachrichten und Transkriptionen
- **Lesezeichen**: Nachrichten mit Notizen speichern, als JSON exportieren/importieren
- **Perspektivmodus**: Chat als beliebiger Teilnehmer anzeigen
- **Statistiken**: Nachrichtenzähler, Aktivitätsdiagramme, Zeitachse
- **Dunkler Modus**: Folgt dem System oder manuelles Umschalten (Einstellung gespeichert)
- **Mehrsprachige Oberfläche**: Englisch, Portugiesisch, Spanisch, Französisch, Deutsch, Italienisch, Niederländisch, Japanisch, Chinesisch, Russisch
- **Desktop-App**: macOS, Windows, Linux via Electron

---

## Schnellstart

### Voraussetzungen

Sie benötigen [Node.js](https://nodejs.org/) (Version 18 oder höher). Laden Sie es von [nodejs.org](https://nodejs.org/) herunter und führen Sie das Installationsprogramm aus.

Um zu überprüfen, ob Sie es haben:
```bash
node --version
```

### App ausführen

1. Klonen oder laden Sie dieses Projekt herunter
2. Öffnen Sie ein Terminal im Projektordner
3. Führen Sie diese Befehle aus:

```bash
npm install
npm run dev
```

4. Öffnen Sie [localhost:5173](http://localhost:5173) in Ihrem Browser
5. Ziehen Sie Ihre WhatsApp `.zip`-Datei auf die Seite

### Desktop-App (optional)

Wenn Sie eine eigenständige App bevorzugen, anstatt Ihren Browser zu verwenden:

```bash
npm run electron:dev    # im Entwicklungsmodus ausführen
npm run electron:build  # Installer für Ihr Betriebssystem erstellen
```

Plattformspezifische Builds:
```bash
npm run electron:build:mac    # macOS (dmg, zip)
npm run electron:build:win    # Windows (nsis, portable)
npm run electron:build:linux  # Linux (AppImage, deb)
```

---

## WhatsApp-Export

Zuerst müssen Sie einen Chat aus WhatsApp auf Ihrem Telefon exportieren. Dies erstellt eine `.zip`-Datei mit Ihren Nachrichten und Medien.

### iPhone
1. WhatsApp öffnen und zu einem Chat gehen
2. Auf Kontakt- oder Gruppennamen oben tippen
3. Nach unten scrollen und **Chat exportieren** tippen
4. **Medien einschließen** wählen, um Fotos, Videos und Sprachnachrichten einzuschließen
5. Datei speichern (Sie können AirDrop zu Ihrem Mac verwenden, in Dateien speichern oder per E-Mail senden)

### Android
1. WhatsApp öffnen und zu einem Chat gehen
2. Auf drei Punkte **⋮** oben rechts tippen
3. **Mehr** → **Chat exportieren** tippen
4. **Medien einschließen** wählen
5. `.zip`-Datei speichern oder auf Ihren Computer teilen

### Tipps
- Große Chats können einige Minuten zum Exportieren benötigen
- Die Datei wird etwa so benannt: `WhatsApp Chat with John.zip`
- Sowohl Einzel- als auch Gruppenchats funktionieren

---

## Datenschutz und Sicherheit

Diese App ist auf Datenschutz ausgelegt. Ihre WhatsApp-Daten verlassen niemals Ihr Gerät.

### Warum es sicher ist

- **100% Offline**: Die App funktioniert komplett ohne Internet. Keine Server, keine Cloud, keine Datenübertragung.
- **Lokale Verarbeitung**: Alle Analysen, Suchen und Verarbeitung passieren in Ihrem Browser oder Electron-App.
- **Lokale KI**: Sprachtranskription verwendet [Whisper](https://openai.com/research/whisper), das lokal via WebGPU läuft. Kein Audio wird an Server oder APIs gesendet.
- **Kein Tracking**: Null Analytik, Telemetrie oder Drittanbieter-Scripts. Kein Google Analytics, keine Cookies.
- **Kein Account erforderlich**: Keine Registrierung, kein Login, keine Erhebung persönlicher Daten.
- **Open Source**: Der gesamte Code ist öffentlich unter [AGPL-3.0](LICENSE). Jeder kann ihn prüfen.

### Wie Sie es überprüfen können

Vertrauen Sie uns nicht einfach. Überprüfen Sie es selbst:

1. **Lesen Sie den Quellcode**  
   Durchsuchen Sie das [GitHub-Repository](https://github.com/rodrigogs/whats-reader). Die Hauptlogik ist in `src/lib/` und `src/routes/`.

2. **Überprüfen Sie Netzwerkanfragen**  
   Öffnen Sie die Browser DevTools (F12) → Network-Tab → Nutzen Sie die App. Sie werden **null externe Anfragen** sehen (außer dem anfänglichen Seitenladen bei der Web-Version).

3. **Testen Sie offline**  
   Trennen Sie die Internetverbindung, dann nutzen Sie die App. Alles funktioniert, weil nichts eine Verbindung benötigt.

4. **Aus Quellcode kompilieren**  
   Klonen Sie das Repository und kompilieren Sie selbst:
   ```bash
   git clone https://github.com/rodrigogs/whats-reader.git
   cd whats-reader
   npm install
   npm run build
   ```

5. **Prüfen Sie die Electron-App**  
   Die Desktop-App verwendet denselben Web-Code. Überprüfen Sie `electron/main.cjs` und `electron/preload.cjs`. Sie handhaben nur Fensterverwaltung und Dateidialoge.

---

## Entwicklung

### Scripts

| Befehl | Beschreibung |
|--------|--------------|
| `npm run dev` | Entwicklungsserver starten auf [localhost:5173](http://localhost:5173) |
| `npm run build` | Für Produktion kompilieren |
| `npm run preview` | Produktions-Build-Vorschau |
| `npm run check` | Typprüfung mit svelte-check |
| `npm run check:watch` | Typprüfung im Watch-Modus |
| `npm run lint` | Linter mit Biome |
| `npm run lint:fix` | Lint-Probleme automatisch beheben |
| `npm run format` | Code mit Biome formatieren |
| `npm run electron` | Electron-App kompilieren und ausführen |
| `npm run electron:dev` | Electron im Entwicklungsmodus ausführen |
| `npm run electron:build` | Electron-Installer kompilieren |
| `npm run electron:build:mac` | Für macOS kompilieren |
| `npm run electron:build:win` | Für Windows kompilieren |
| `npm run electron:build:linux` | Für Linux kompilieren |
| `npm run machine-translate` | Auto-Übersetzung mit inlang |

### Übersetzungen hinzufügen

Übersetzungsdateien sind in `messages/`. Um eine neue Sprache hinzuzufügen:
1. Kopieren Sie `messages/en.json` nach `messages/{locale}.json`
2. Übersetzen Sie die Strings
3. Fügen Sie das Locale zu `project.inlang/settings.json` hinzu

---

## Erstellt mit

- [SvelteKit](https://kit.svelte.dev) + [Svelte 5](https://svelte.dev) - Framework
- [Tailwind CSS 4](https://tailwindcss.com) - Styling
- [Electron](https://electronjs.org) - Desktop-App
- [Transformers.js](https://huggingface.co/docs/transformers.js) - Whisper-KI für Transkription
- [JSZip](https://stuk.github.io/jszip/) - ZIP-Dateiverarbeitung
- [Paraglide JS](https://inlang.com/m/gerre34r/library-inlang-paraglideJs) - Internationalisierung

---

## Mitwirken

Bug oder Idee? [Issue öffnen](https://github.com/rodrigogs/whats-reader/issues) auf GitHub.

Möchten Sie Code beitragen? Forken Sie das Repository, nehmen Sie Ihre Änderungen vor und öffnen Sie einen Pull Request.

Es gibt Beispiel-Chat-Dateien in `examples/chats/`, die Sie zum Testen verwenden können.
---

## Lizenz

[AGPL-3.0](LICENSE). Sie können diese Software frei verwenden, modifizieren und verteilen. Wenn Sie sie modifizieren und als Dienst ausführen oder verteilen, müssen Sie Ihren Quellcode unter derselben Lizenz teilen.

