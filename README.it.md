# <h1 align="center">Lettore di Backup WhatsApp</h1>

<p align="center">
  <img src="src/lib/assets/favicon.svg" width="100" height="100" alt="Lettore di Backup WhatsApp" />
</p>

<p align="center">
  <strong>Esplora le tue esportazioni WhatsApp offline. I tuoi dati rimangono sul tuo dispositivo.</strong>
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

---

## Cosa fa?

Trascina un file `.zip` esportato da WhatsApp ed esplora i tuoi messaggi, foto e note vocali. Funziona con chat grandi (testato con oltre 10k messaggi).

I messaggi vocali possono essere trascritti usando [Whisper](https://openai.com/research/whisper), che viene eseguito nel tuo browser tramite WebGPU. Nessun server, nessuna chiave API necessaria.

## Caratteristiche

- **Trascrizione vocale**: Trascrivi audio con Whisper (eseguito localmente, oltre 12 lingue)
- **Ricerca**: Ricerca full-text in messaggi e trascrizioni
- **Segnalibri**: Salva messaggi con note, esporta/importa come JSON
- **Modalità prospettiva**: Visualizza la chat come qualsiasi partecipante
- **Statistiche**: Conteggio messaggi, grafici di attività, timeline
- **Modalità scura**: Segue il sistema o cambia manualmente (preferenza salvata)
- **Interfaccia multilingue**: Inglese, Portoghese, Spagnolo, Francese, Tedesco, Italiano, Olandese, Giapponese, Cinese, Russo
- **App desktop**: macOS, Windows, Linux tramite Electron

## Avvio Rapido

### Prerequisiti

Hai bisogno di [Node.js](https://nodejs.org/) installato (versione 18 o successiva).

```bash
node --version
```

### Esecuzione dell'app

```bash
npm install
npm run dev
```

Apri [localhost:5173](http://localhost:5173) nel tuo browser e trascina il tuo file `.zip` di WhatsApp.

### App desktop (opzionale)

```bash
npm run electron:dev    # esegui in modalità sviluppo
npm run electron:build  # crea un installer per il tuo SO
```

## Come Esportare da WhatsApp

### iPhone
1. Apri WhatsApp e vai a qualsiasi chat
2. Tocca il nome del contatto o del gruppo in cima allo schermo
3. Scorri in basso e tocca **Esporta Chat**
4. Scegli **Includi Media** per includere foto, video e messaggi vocali
5. Salva il file (puoi usare AirDrop, salvare su File o inviarlo via email)

### Android
1. Apri WhatsApp e vai a qualsiasi chat
2. Tocca i tre punti **⋮** nell'angolo in alto a destra
3. Tocca **Altro** → **Esporta chat**
4. Scegli **Includi media**
5. Salva o condividi il file `.zip` sul tuo computer

## Privacy e Sicurezza

Questa app è progettata con la privacy come massima priorità. I tuoi dati WhatsApp non lasciano mai il tuo dispositivo.

### Perché è sicuro

- **100% Offline**: L'app funziona completamente senza internet
- **Elaborazione Locale**: Tutta l'analisi, ricerca e elaborazione avvengono nel tuo browser
- **IA Locale**: La trascrizione vocale usa Whisper eseguito localmente tramite WebGPU
- **Nessun Tracciamento**: Zero analytics, telemetria o script di terze parti
- **Nessun account richiesto**: Nessuna registrazione, nessun login
- **Open Source**: Tutto il codice è pubblico sotto licenza AGPL-3.0

## Script di Sviluppo

| Comando | Descrizione |
|---------|-------------|
| `npm run dev` | Avvia il server di sviluppo |
| `npm run build` | Compila per la produzione |
| `npm run check` | Controllo dei tipi con svelte-check |
| `npm run lint` | Linter con Biome |
| `npm run electron:dev` | Esegui Electron in modalità sviluppo |
| `npm run electron:build` | Compila installer Electron |

## Costruito con

- [SvelteKit](https://kit.svelte.dev) + [Svelte 5](https://svelte.dev) - Framework
- [Tailwind CSS 4](https://tailwindcss.com) - Stili
- [Electron](https://electronjs.org) - App desktop
- [Transformers.js](https://huggingface.co/docs/transformers.js) - IA Whisper per trascrizione
- [JSZip](https://stuk.github.io/jszip/) - Gestione file ZIP

## Contribuire

Hai trovato un bug o hai un'idea? [Apri una issue](https://github.com/rodrigogs/whats-reader/issues) su GitHub.

Vuoi contribuire con codice? Fai un fork del repository, fai le tue modifiche e apri una pull request.

## Licenza

[AGPL-3.0](LICENSE). Puoi usare, modificare e distribuire questo software liberamente. Se lo modifichi ed esegui come servizio o lo distribuisci, devi condividere il tuo codice sorgente sotto la stessa licenza.
