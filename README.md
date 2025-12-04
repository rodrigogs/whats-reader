<h1 align="center">WhatsApp Backup Reader</h1>

<p align="center">
  <img src="static/favicon.svg" width="120" height="120" alt="WhatsApp Backup Reader" />
</p>

<p align="center">
  <strong>Read your WhatsApp exports offline, with AI-powered voice transcription.</strong><br>
  Your data stays on your device. Nothing is uploaded anywhere.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/svelte-5-FF3E00?logo=svelte&logoColor=white" alt="Svelte 5" />
  <img src="https://img.shields.io/badge/runs_in-browser-4285F4?logo=googlechrome&logoColor=white" alt="Runs in browser" />
  <img src="https://img.shields.io/badge/AI-local_only-00A67E?logo=openai&logoColor=white" alt="Local AI" />
</p>

---

## What it does

Drop a WhatsApp `.zip` export and get a familiar chat interface to browse your messages, media, and voice notes. The app handles large backups (10,000+ messages, 500+ media files) smoothly thanks to chunked rendering and lazy loading.

**Voice transcription** uses [Whisper](https://openai.com/research/whisper) running entirely in your browser via WebGPU/WASM. No API calls, no cloud, no cost.

<details>
<summary><strong>Screenshots</strong> (click to expand)</summary>

> _Coming soon_

</details>

---

## Features

| Feature | Description |
|---------|-------------|
| 🎤 **Voice Transcription** | Transcribe audio messages with Whisper. Supports 12 languages. Runs 100% locally. |
| 🔍 **Full-text Search** | Search messages and transcriptions. Results highlighted in real-time. |
| 🔖 **Bookmarks** | Save important messages with notes. Export/import your bookmarks as JSON. |
| 👤 **Perspective Mode** | View the chat "as" a specific participant. See which messages appear on which side. |
| 📊 **Chat Statistics** | Message counts by participant, activity by hour/day, conversation timeline. |
| 🌙 **Dark Mode** | Follows system preference, or toggle manually. |
| 📱 **PWA Ready** | Install as a standalone app on desktop or mobile. |
| ⚡ **Fast & Private** | Chunked rendering, lazy media loading, and zero network requests. |

---

## Quick Start

```bash
npm install
npm run dev
```

Open [localhost:5173](http://localhost:5173) and drop your `.zip` file.

### Desktop App (Electron)

```bash
npm run electron:dev      # development
npm run electron:build    # package for your OS
```

---

## How to Export from WhatsApp

1. Open any chat in WhatsApp
2. Tap **⋮** → **More** → **Export chat**
3. Select **Include media**
4. Save the `.zip` and drop it in the app

---

## Tech Stack

- **[SvelteKit 2](https://kit.svelte.dev)** + **Svelte 5** runes
- **[Tailwind CSS 4](https://tailwindcss.com)**
- **[Transformers.js](https://huggingface.co/docs/transformers.js)** for Whisper transcription
- **[Electron](https://electronjs.org)** for optional desktop builds
- **Web Workers** for search and stats off the main thread

---

## Contributing

Found a bug? Have an idea? [Open an issue](../../issues) or submit a PR.
