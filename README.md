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
| 🎤 **Voice Transcription** | Transcribe audio messages with Whisper. Supports 12+ languages. Runs 100% locally via WebGPU/WASM. |
| 🔍 **Full-text Search** | Search messages and transcriptions. Results highlighted in real-time. |
| 🔖 **Bookmarks** | Save important messages with notes. Export/import your bookmarks as JSON. |
| 👤 **Perspective Mode** | View the chat "as" a specific participant. See which messages appear on which side. |
| 📊 **Chat Statistics** | Message counts by participant, activity by hour/day, conversation timeline. |
| 🌙 **Dark Mode** | Follows system preference, or toggle manually. |
| 📱 **PWA Ready** | Install as a standalone app on desktop or mobile. |
| ⚡ **Fast & Private** | Chunked rendering, lazy media loading, and zero network requests. |
| 🖥️ **Desktop App** | Native macOS, Windows, and Linux apps via Electron. |
| 📐 **Collapsible Sidebar** | Hide the chat list to maximize reading area on any screen size. |

---

## Quick Start

### Web Version

```bash
npm install
npm run dev
```

Open [localhost:5173](http://localhost:5173) and drop your `.zip` file.

### Desktop App (Electron)

```bash
npm run electron:dev          # development with hot reload
npm run electron:build        # package for your OS
npm run electron:build:mac    # macOS only
npm run electron:build:win    # Windows only
npm run electron:build:linux  # Linux only
```

---

## Try It Out

Don't have a WhatsApp export? Use our example files to test the app:

```bash
cd examples/chats
./build-zips.sh
```

This creates two test exports:
- **`family-group-chat.zip`** — A group chat with 4 participants, system messages, images, voice notes, and video
- **`private-chat.zip`** — A 1:1 conversation with images and voice notes

See [`examples/README.md`](examples/README.md) for more details.

---

## How to Export from WhatsApp

### iOS
1. Open any chat in WhatsApp
2. Tap the contact/group name at the top
3. Scroll down and tap **Export Chat**
4. Select **Attach Media** (or "Include Media")
5. Choose how to save (AirDrop, Files, etc.)

### Android
1. Open any chat in WhatsApp
2. Tap **⋮** (three dots) → **More** → **Export chat**
3. Select **Include media**
4. Save the `.zip` file

### Tips
- Large chats with many media files may take a few minutes to export
- The exported ZIP contains a `_chat.txt` file and all media files
- Both group chats and individual chats are supported

---

## Tech Stack

| Category | Technology |
|----------|------------|
| **Frontend** | [SvelteKit 2](https://kit.svelte.dev) + [Svelte 5](https://svelte.dev) (runes) |
| **Styling** | [Tailwind CSS 4](https://tailwindcss.com) |
| **Desktop** | [Electron](https://electronjs.org) with electron-builder |
| **AI/Transcription** | [Transformers.js](https://huggingface.co/docs/transformers.js) (Whisper via WebGPU/WASM) |
| **ZIP Handling** | [JSZip](https://stuk.github.io/jszip/) |
| **Performance** | Web Workers for search & stats computation |

---

## Project Structure

```
whats-reader/
├── src/
│   ├── lib/
│   │   ├── components/    # Svelte components
│   │   ├── parser/        # Chat & ZIP parsing logic
│   │   ├── stores/        # State management
│   │   └── workers/       # Web Workers
│   └── routes/            # SvelteKit pages
├── electron/              # Electron main process
├── examples/              # Test chat exports
├── static/                # Icons and static assets
└── build/                 # Production build output
```

---

## Contributing

Contributions are welcome! Here's how you can help:

- 🐛 **Report bugs** — [Open an issue](../../issues) with steps to reproduce
- 💡 **Suggest features** — Share your ideas in [Discussions](../../discussions)
- 🔧 **Submit PRs** — Fork the repo, make your changes, and open a pull request
- 📖 **Improve docs** — Help make the README and code comments clearer
- 🌍 **Translations** — Help support more WhatsApp export formats (different locales)

### Development Setup

```bash
git clone https://github.com/yourusername/whats-reader.git
cd whats-reader
npm install
npm run dev
```

### Testing with Example Data

```bash
cd examples/chats
./build-zips.sh
# Then drag the generated ZIP files into the app
```

---

## License

MIT © [Rodrigo Gomes](https://github.com/yourusername)
