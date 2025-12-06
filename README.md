<h1 align="center">WhatsApp Backup Reader</h1>

<p align="center">
  <img src="static/favicon.svg" width="100" height="100" alt="WhatsApp Backup Reader" />
</p>

<p align="center">
  <strong>Browse your WhatsApp exports offline. Your data stays on your device.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/svelte-5-FF3E00?logo=svelte&logoColor=white" alt="Svelte 5" />
  <img src="https://img.shields.io/badge/electron-39-47848F?logo=electron&logoColor=white" alt="Electron" />
  <img src="https://img.shields.io/badge/AI-local_whisper-00A67E?logo=openai&logoColor=white" alt="Local AI" />
  <img src="https://img.shields.io/badge/privacy-100%25_offline-blue" alt="Privacy" />
  <img src="https://img.shields.io/badge/i18n-EN%20%7C%20PT-green" alt="Languages" />
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#how-to-export-from-whatsapp">Export Guide</a> •
  <a href="#contributing">Contributing</a>
</p>

---

## What it does

Drop a WhatsApp `.zip` export and browse your messages, photos, and voice notes. Works with big chats (tested with 10k+ messages).

Voice messages can be transcribed using [Whisper](https://openai.com/research/whisper), which runs in your browser via WebGPU. No server, no API key needed.

<details>
<summary>Screenshots</summary>
<br>

| Start Screen | Chat View |
|:---:|:---:|
| <img src="examples/images/1-start.png" width="400" /> | <img src="examples/images/2-chats.png" width="400" /> |

| Chat Options | Perspective Mode |
|:---:|:---:|
| <img src="examples/images/3-chat-options.png" width="400" /> | <img src="examples/images/4-view-as.png" width="400" /> |

| Bookmarks | Statistics |
|:---:|:---:|
| <img src="examples/images/5-bookmarks.png" width="400" /> | <img src="examples/images/6-statistics.png" width="400" /> |

| Voice Transcription |
|:---:|
| <img src="examples/images/7-audio-transcription.png" width="400" /> |

</details>

---

## Features

- **Voice transcription** — Transcribe audio with Whisper (runs locally, 12+ languages)
- **Search** — Full-text search across messages and transcriptions
- **Bookmarks** — Save messages with notes, export/import as JSON
- **Perspective mode** — View the chat as any participant
- **Statistics** — Message counts, activity charts, timeline
- **Dark mode** — Follows system or toggle manually (preference saved)
- **Multi-language UI** — English and Portuguese (more coming soon)
- **Desktop app** — macOS, Windows, Linux via Electron

---

## Quick Start

### Prerequisites

You need [Node.js](https://nodejs.org/) installed (version 18 or later). Download it from [nodejs.org](https://nodejs.org/) and run the installer.

To check if you have it:
```bash
node --version
```

### Running the app

1. Clone or download this project
2. Open a terminal in the project folder
3. Run these commands:

```bash
npm install
npm run dev
```

4. Open [localhost:5173](http://localhost:5173) in your browser
5. Drag and drop your WhatsApp `.zip` file into the page

### Desktop app (optional)

If you prefer a standalone app instead of using your browser:

```bash
npm run electron:dev    # run in dev mode
npm run electron:build  # create an installer for your OS
```

Platform-specific builds:
```bash
npm run electron:build:mac    # macOS (dmg, zip)
npm run electron:build:win    # Windows (nsis, portable)
npm run electron:build:linux  # Linux (AppImage, deb)
```

---

## How to Export from WhatsApp

First, you need to export a chat from WhatsApp on your phone. This creates a `.zip` file containing your messages and media.

### iPhone
1. Open WhatsApp and go to any chat
2. Tap the contact or group name at the top of the screen
3. Scroll down and tap **Export Chat**
4. Choose **Attach Media** to include photos, videos, and voice messages
5. Save the file (you can AirDrop it to your Mac, save to Files, or email it to yourself)

### Android
1. Open WhatsApp and go to any chat
2. Tap the three dots **⋮** in the top right corner
3. Tap **More** → **Export chat**
4. Choose **Include media**
5. Save or share the `.zip` file to your computer

### Tips
- Large chats may take a few minutes to export
- The file will be named something like `WhatsApp Chat with John.zip`
- Both individual and group chats work

---

## Development

### Project structure

```
src/
├── lib/
│   ├── components/    # Svelte components
│   ├── paraglide/     # i18n generated files
│   ├── actions/       # Svelte actions
│   └── *.svelte.ts    # State and utilities
├── routes/            # SvelteKit routes
messages/              # Translation files (en.json, pt.json)
electron/              # Electron main process
static/                # Static assets
```

### Scripts

```bash
npm run dev           # Start dev server
npm run build         # Build for production
npm run check         # Type check
npm run lint          # Lint with Biome
npm run lint:fix      # Auto-fix lint issues
npm run format        # Format code
```

### Adding translations

Translation files are in `messages/`. To add a new language:
1. Copy `messages/en.json` to `messages/{locale}.json`
2. Translate the strings
3. Add the locale to `project.inlang/settings.json`

---

## Built with

- [SvelteKit](https://kit.svelte.dev) + [Svelte 5](https://svelte.dev) — Framework
- [Tailwind CSS 4](https://tailwindcss.com) — Styling
- [Electron](https://electronjs.org) — Desktop app
- [Transformers.js](https://huggingface.co/docs/transformers.js) — Whisper AI for transcription
- [JSZip](https://stuk.github.io/jszip/) — ZIP file handling
- [Paraglide JS](https://inlang.com/m/gerre34r/library-inlang-paraglideJs) — Internationalization

---

## Contributing

Found a bug or have an idea? [Open an issue](https://github.com/rodrigogs/whats-reader/issues) on GitHub.

Want to contribute code? Fork the repo, make your changes, and open a pull request.

There are example chat files in `examples/chats/` you can use for testing.

---

## License

[AGPL-3.0](LICENSE) — You can use, modify, and distribute this software freely. If you modify it and run it as a service or distribute it, you must share your source code under the same license.
