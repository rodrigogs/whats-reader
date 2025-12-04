# WhatsApp Backup Reader

A desktop application to read and visualize WhatsApp chat exports (.zip backups).

![SvelteKit](https://img.shields.io/badge/SvelteKit-2.x-FF3E00?logo=svelte)
![Electron](https://img.shields.io/badge/Electron-39.x-47848F?logo=electron)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.x-06B6D4?logo=tailwindcss)

## Features

- 📱 **WhatsApp-style UI** - Familiar green theme matching WhatsApp's design
- 📁 **ZIP backup support** - Import WhatsApp chat exports directly
- 🖼️ **Lazy media loading** - Large backups don't crash your machine
- 🔍 **Search** - Find messages within conversations
- 📊 **Chat statistics** - View message counts and participant info
- 🌍 **Portuguese support** - Full support for PT-BR date formats and messages
- 🖥️ **Cross-platform** - Works on macOS, Windows, and Linux

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or pnpm

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/whats-reader.git
cd whats-reader

# Install dependencies
npm install
```

### Development

```bash
# Run in browser (development)
npm run dev

# Run with Electron (development)
npm run electron:dev
```

### Building

```bash
# Build for production
npm run build

# Build Electron app for your platform
npm run electron:build

# Platform-specific builds
npm run electron:build:mac
npm run electron:build:win
npm run electron:build:linux
```

## Usage

1. Export a WhatsApp chat:
   - Open WhatsApp on your phone
   - Go to a chat → Menu (⋮) → More → Export chat
   - Choose "Include media" and save as .zip

2. Open the app and drag & drop the .zip file, or click to browse

3. View your messages with all media (images, videos, audio, stickers)

## Memory Efficiency

The app uses lazy loading for media files:
- Media files are cataloged but not loaded into memory
- Images/videos load only when clicked
- Maximum 50 media files cached at once
- Handles backups with 500+ media files without issues

## License

MIT
