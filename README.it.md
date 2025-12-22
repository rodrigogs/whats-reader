<h1 align="center">Lettore di Backup WhatsApp</h1>

<p align="center">
  <img src="src/lib/assets/favicon.svg" width="100" height="100" alt="Lettore di Backup WhatsApp" />
</p>

<p align="center">
  <strong>Esplora le tue esportazioni WhatsApp offline. I tuoi dati rimangono sul tuo dispositivo.</strong>
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
  <a href="README.de.md">Deutsch</a> •
  <strong>Italiano</strong> •
  <a href="README.nl.md">Nederlands</a> •
  <a href="README.ja.md">日本語</a> •
  <a href="README.zh.md">中文</a> •
  <a href="README.ru.md">Русский</a>
</p>

<p align="center">
  <a href="#caratteristiche">Caratteristiche</a> •
  <a href="#avvio-rapido">Avvio Rapido</a> •
  <a href="#come-esportare-da-whatsapp">Guida Esportazione</a> •
  <a href="#privacy-e-sicurezza">Privacy</a> •
  <a href="#contribuire">Contribuire</a>
</p>

---

## Cosa fa?

Trascina un file `.zip` esportato da WhatsApp ed esplora i tuoi messaggi, foto e note vocali. Funziona con chat grandi (testato con oltre 10k messaggi).

I messaggi vocali possono essere trascritti usando [Whisper](https://openai.com/research/whisper), che viene eseguito nel tuo browser tramite WebGPU. Nessun server, nessuna chiave API necessaria.

<details>
<summary>Screenshot</summary>
<br>

| Schermata Iniziale | Vista Chat |
|:---:|:---:|
| <img src="examples/images/1-start.png" width="400" /> | <img src="examples/images/2-chats.png" width="400" /> |

| Opzioni Chat | Modalità Prospettiva |
|:---:|:---:|
| <img src="examples/images/3-chat-options.png" width="400" /> | <img src="examples/images/4-view-as.png" width="400" /> |

| Segnalibri | Statistiche |
|:---:|:---:|
| <img src="examples/images/5-bookmarks.png" width="400" /> | <img src="examples/images/6-statistics.png" width="400" /> |

| Trascrizione Vocale | Galleria multimediale |
|:---:|:---:|
| <img src="examples/images/7-audio-transcription.png" width="400" /> | <img src="examples/images/8-media-gallery.png" width="400" /> |

| Scarica selezionati | Vai alla data |
|:---:|:---:|
| <img src="examples/images/9-media-gallery-download-selected.png" width="400" /> | <img src="examples/images/10-media-gallery-goto-date.png" width="400" /> |

</details>

---

## Download

Scarica l'app per la tua piattaforma:

### Windows
- Scarica **WhatsApp-Backup-Reader-Setup-{version}.exe** dall'[ultima versione](https://github.com/rodrigogs/whats-reader/releases/latest)
- Esegui l'installer e segui la procedura guidata
- L'app si aggiornerà automaticamente quando saranno disponibili nuove versioni

### macOS
- **Apple Silicon (M1/M2/M3)**: Scarica **WhatsApp-Backup-Reader-{version}-arm64.dmg**
- **Intel**: Scarica **WhatsApp-Backup-Reader-{version}.dmg**
- Apri il file DMG e trascina l'app in Applicazioni
- Al primo avvio, fai clic destro sull'app e seleziona "Apri" per bypassare Gatekeeper

### Linux
- **Debian/Ubuntu**: Scarica **whats-reader_{version}_amd64.deb** o **whats-reader_{version}_arm64.deb**
  ```bash
  sudo dpkg -i whats-reader_{version}_amd64.deb
  ```
- **Fedora/RHEL**: Scarica **whats-reader-{version}.x86_64.rpm** o **whats-reader-{version}.aarch64.rpm**
  ```bash
  sudo rpm -i whats-reader-{version}.x86_64.rpm
  ```
- **Altre distro (Arch, etc.)**: Scarica **WhatsApp-Backup-Reader-{version}.AppImage**
  ```bash
  chmod +x WhatsApp-Backup-Reader-{version}.AppImage
  ./WhatsApp-Backup-Reader-{version}.AppImage
  ```

> **Oppure usa la versione web**: Visita [rodrigogs.github.io/whats-reader](https://rodrigogs.github.io/whats-reader) - nessuna installazione richiesta!

---

## Caratteristiche

- **Trascrizione vocale**: Trascrivi audio con Whisper (eseguito localmente, oltre 12 lingue)
- **Ricerca**: Ricerca full-text in messaggi e trascrizioni
- **Segnalibri**: Salva messaggi con note, esporta/importa come JSON
- **Modalità prospettiva**: Visualizza la chat come qualsiasi partecipante
- **Statistiche**: Conteggio messaggi, grafici di attività, timeline
- **Modalità scura**: Segue il sistema o cambia manualmente (preferenza salvata)
- **Interfaccia multilingue**: Inglese, Portoghese, Spagnolo, Francese, Tedesco, Italiano, Olandese, Giapponese, Cinese, Russo
- **App desktop**: macOS, Windows, Linux tramite Electron

---

## Avvio Rapido

### Prerequisiti

Hai bisogno di [Node.js](https://nodejs.org/) installato (versione 18 o successiva). Scaricalo da [nodejs.org](https://nodejs.org/) ed esegui l'installer.

Per verificare se ce l'hai:
```bash
node --version
```

### Esecuzione dell'app

1. Clona o scarica questo progetto
2. Apri un terminale nella cartella del progetto
3. Esegui questi comandi:

```bash
npm install
npm run dev
```

4. Apri [localhost:5173](http://localhost:5173) nel tuo browser
5. Trascina il tuo file `.zip` di WhatsApp nella pagina

### App desktop (opzionale)

Se preferisci un'app standalone invece di usare il browser:

```bash
npm run electron:dev    # esegui in modalità sviluppo
npm run electron:build  # crea un installer per il tuo SO
```

Build specifiche per piattaforma:
```bash
npm run electron:build:mac    # macOS (dmg, zip)
npm run electron:build:win    # Windows (nsis, portable)
npm run electron:build:linux  # Linux (deb, rpm, AppImage)
```

---

## Come Esportare da WhatsApp

Prima di tutto, devi esportare una chat da WhatsApp sul tuo telefono. Questo crea un file `.zip` contenente i tuoi messaggi e media.

### iPhone
1. Apri WhatsApp e vai a qualsiasi chat
2. Tocca il nome del contatto o del gruppo in cima allo schermo
3. Scorri in basso e tocca **Esporta Chat**
4. Scegli **Includi Media** per includere foto, video e messaggi vocali
5. Salva il file (puoi usare AirDrop per inviarlo al tuo Mac, salvare su File o inviarlo via email)

### Android
1. Apri WhatsApp e vai a qualsiasi chat
2. Tocca i tre punti **⋮** nell'angolo in alto a destra
3. Tocca **Altro** → **Esporta chat**
4. Scegli **Includi media**
5. Salva o condividi il file `.zip` sul tuo computer

### Suggerimenti
- Le chat grandi potrebbero richiedere alcuni minuti per l'esportazione
- Il file sarà denominato qualcosa come `WhatsApp Chat with John.zip`
- Funzionano sia le chat individuali che di gruppo

---

## Privacy e Sicurezza

Questa app è progettata con la privacy come massima priorità. I tuoi dati WhatsApp non lasciano mai il tuo dispositivo.

### Perché è sicuro

- **100% Offline**: L'app funziona completamente senza internet. Nessun server, nessun cloud, nessuna trasmissione dati.
- **Elaborazione Locale**: Tutta l'analisi, ricerca e elaborazione avvengono nel tuo browser o app Electron.
- **IA Locale**: La trascrizione vocale usa [Whisper](https://openai.com/research/whisper) eseguito localmente tramite WebGPU. Nessun audio viene inviato a server o API.
- **Nessun Tracciamento**: Zero analytics, telemetria o script di terze parti. Nessun Google Analytics, nessun cookie.
- **Nessun account richiesto**: Nessuna registrazione, nessun login, nessun dato personale raccolto.
- **Open Source**: L'intero codice è pubblico sotto licenza [AGPL-3.0](LICENSE). Chiunque può controllarlo.

### Come verificare

Non fidarti solo di noi. Verificalo tu stesso:

1. **Leggi il codice sorgente**  
   Esplora il [repository GitHub](https://github.com/rodrigogs/whats-reader). La logica principale è in `src/lib/` e `src/routes/`.

2. **Controlla le richieste di rete**  
   Apri gli Strumenti per Sviluppatori del browser (F12) → scheda Network → Usa l'app. Vedrai **zero richieste esterne** (eccetto il caricamento iniziale della pagina se usi la versione web).

3. **Testa offline**  
   Disconnettiti da internet, poi usa l'app. Tutto funziona perché nulla richiede una connessione.

4. **Compila dal sorgente**  
   Clona il repo e compilalo tu stesso:
   ```bash
   git clone https://github.com/rodrigogs/whats-reader.git
   cd whats-reader
   npm install
   npm run build
   ```

5. **Controlla l'app Electron**  
   L'app desktop usa lo stesso codice web. Controlla `electron/main.cjs` e `electron/preload.cjs`. Gestiscono solo la finestra e i dialoghi dei file.

---

## Sviluppo

### Script

| Comando | Descrizione |
|---------|-------------|
| `npm run dev` | Avvia il server di sviluppo su [localhost:5173](http://localhost:5173) |
| `npm run build` | Compila per la produzione |
| `npm run preview` | Anteprima della build di produzione |
| `npm run check` | Controllo dei tipi con svelte-check |
| `npm run check:watch` | Controllo dei tipi in modalità watch |
| `npm run lint` | Linter con Biome |
| `npm run lint:fix` | Correggi automaticamente problemi di lint |
| `npm run format` | Formatta il codice con Biome |
| `npm run electron` | Compila ed esegui l'app Electron |
| `npm run electron:dev` | Esegui Electron in modalità sviluppo |
| `npm run electron:build` | Compila installer Electron |
| `npm run electron:build:mac` | Compila per macOS |
| `npm run electron:build:win` | Compila per Windows |
| `npm run electron:build:linux` | Compila per Linux |
| `npm run machine-translate` | Auto-traduzione con inlang |

### Aggiungere traduzioni

I file di traduzione sono in `messages/`. Per aggiungere una nuova lingua:
1. Copia `messages/en.json` in `messages/{locale}.json`
2. Traduci le stringhe
3. Aggiungi il locale a `project.inlang/settings.json`

---

## Costruito con

- [SvelteKit](https://kit.svelte.dev) + [Svelte 5](https://svelte.dev) - Framework
- [Tailwind CSS 4](https://tailwindcss.com) - Stili
- [Electron](https://electronjs.org) - App desktop
- [Transformers.js](https://huggingface.co/docs/transformers.js) - IA Whisper per trascrizione
- [JSZip](https://stuk.github.io/jszip/) - Gestione file ZIP
- [Paraglide JS](https://inlang.com/m/gerre34r/library-inlang-paraglideJs) - Internazionalizzazione

---

## Contribuire

Hai trovato un bug o hai un'idea? [Apri una issue](https://github.com/rodrigogs/whats-reader/issues) su GitHub.

Vuoi contribuire con codice? Fai un fork del repository, fai le tue modifiche e apri una pull request.

Ci sono file di chat di esempio in `examples/chats/` che puoi usare per i test.

---

## Licenza

[AGPL-3.0](LICENSE). Puoi usare, modificare e distribuire questo software liberamente. Se lo modifichi ed esegui come servizio o lo distribuisci, devi condividere il tuo codice sorgente sotto la stessa licenza.
