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
- **Dark mode** — Follows system or toggle manually
- **Desktop app** — macOS, Windows, Linux via Electron

---

## Quick Start

```bash
npm install
npm run dev
```

Open [localhost:5173](http://localhost:5173) and drop your `.zip` file.

For the desktop app:

```bash
npm run electron:dev    # dev mode
npm run electron:build  # build for your OS
```

---

## How to Export from WhatsApp

### iOS
1. Open a chat → tap the name at the top
2. Scroll down → **Export Chat** → **Attach Media**
3. Save the `.zip`

### Android
1. Open a chat → **⋮** → **More** → **Export chat**
2. Select **Include media**
3. Save the `.zip`

---

## Built with

[SvelteKit](https://kit.svelte.dev) + [Svelte 5](https://svelte.dev), [Tailwind CSS 4](https://tailwindcss.com), [Electron](https://electronjs.org), [Transformers.js](https://huggingface.co/docs/transformers.js) for Whisper, [JSZip](https://stuk.github.io/jszip/).

---

## Contributing

Bug reports, feature ideas, and PRs are welcome. 

```bash
git clone https://github.com/rodrigogs/whats-reader.git
cd whats-reader
npm install
npm run dev
```

There are example chat files in `examples/chats/` if you need test data.

---

## License

MIT
