# WhatsApp Backup Reader - AI Agent Instructions

## Architecture Overview

**Hybrid SvelteKit + Electron app** for parsing and viewing WhatsApp chat exports offline. Runs as both a web app (GitHub Pages) and desktop app (Electron).

### Core Design Principles
- **100% Offline**: No external API calls, all processing happens client-side
- **Privacy-first**: No analytics, no telemetry, no data transmission
- **Web Workers**: CPU-intensive tasks (search indexing, transcription) run in workers
- **Svelte 5 Runes**: All state management uses `$state`, `$derived`, `$effect` (no stores)

## State Management (Svelte 5 Runes)

**Critical**: This project uses **Svelte 5 runes exclusively**. Never use Svelte 4 stores (`writable`, `derived`, `readable`).

### Global State Pattern

State lives in `*.svelte.ts` files using factory functions that return getter/action objects:

```typescript
// src/lib/state.svelte.ts
export function createAppState() {
  let chats = $state<ChatData[]>([]);
  let selectedIndex = $state<number | null>(null);
  
  const selectedChat = $derived(
    selectedIndex !== null ? chats[selectedIndex] : null
  );
  
  return {
    get chats() { return chats; },
    get selectedChat() { return selectedChat; },
    addChat(chat: ChatData) { chats = [...chats, chat]; }
  };
}

export const appState = createAppState();
```

**Key files**: `src/lib/state.svelte.ts`, `src/lib/bookmarks.svelte.ts`, `src/lib/transcription.svelte.ts`

### Reactivity Rules
- Use `$derived` for computed values, not functions
- Use `$effect` for side effects (DOM sync, cleanup)
- Use `untrack()` to read reactive values without subscribing
- Never mutate state directly - always reassign: `items = [...items, newItem]`

## Web Workers

Three workers handle heavy operations:

1. **Index Worker** (`src/lib/workers/index-worker.ts`): Builds message search index when chat loads
2. **Search Worker** (`src/lib/workers/search-worker.ts`): Performs search queries with progress updates
3. **Transcription Worker** (in `@huggingface/transformers`): Runs Whisper model for audio transcription

### Worker Communication Pattern

```typescript
// Main thread initiates worker
const worker = new Worker(new URL('./search-worker.ts', import.meta.url), {
  type: 'module'
});

// Send work with unique ID for cancellation
worker.postMessage({ id: searchId, query, messages });

// Handle progress + results
worker.onmessage = (e) => {
  if (e.data.type === 'progress') {
    searchProgress = e.data.progress;
  } else if (e.data.type === 'complete') {
    searchResultIds = e.data.resultIds;
  }
};
```

**Never** run expensive operations on main thread - always delegate to workers.

## Internationalization (i18n)

Uses **Paraglide JS** (compile-time i18n, not runtime lookups).

### Adding Translations

1. Add key to `messages/en.json` (source of truth):
   ```json
   {
     "search_placeholder": "Search messages..."
   }
   ```

2. Run machine translation: `npm run machine-translate`

3. Import and use in components:
   ```svelte
   <script>
   import * as m from '$lib/paraglide/messages';
   </script>
   <input placeholder={m.search_placeholder()} />
   ```

**Never** hardcode user-facing strings. All 10 languages must stay in sync.

## Parser System

WhatsApp exports use different date formats by locale. Parser supports:
- US format: `12/25/2024, 3:45 PM`
- European: `25/12/2024, 15:45`
- ISO: `2024-12-25 15:45:00`

`src/lib/parser/chat-parser.ts` tries all formats with regex patterns. Test new formats in `examples/parser-tests/`.

### Chat Data Structure

```typescript
interface ChatData {
  title: string;
  messages: ChatMessage[];
  participants: string[];
  messageIndex: Map<string, number>;  // O(1) lookup
  flatItems: FlatItem[];  // For virtual scrolling
  messagesById: Map<string, ChatMessage>;
}
```

## Build System

### Dual-Target Builds

**SvelteKit adapter-static** generates single-page app:
- **Web**: Base path `/whats-reader` for GitHub Pages (when `GITHUB_PAGES=true`)
- **Electron**: Relative paths (`base: './'`) to load from `file://`

`svelte.config.js` switches between these using `process.env.GITHUB_PAGES`.

### Build Commands

```bash
npm run build              # SvelteKit build → build/
npm run electron:build     # Build + Electron packaging → dist-electron/
npm run electron:build:mac # Platform-specific (mac/win/linux)
```

Electron config in `package.json` under `"build"` key. Icons: `static/icon.{icns,ico,png}`.

## Development Workflows

### Running Locally

```bash
npm run dev              # Web app on localhost:5173
npm run electron:dev     # Electron app (concurrently runs Vite + Electron)
```

### Code Quality

```bash
npm run lint            # Biome check (not ESLint!)
npm run lint:fix        # Auto-fix
npm run check           # TypeScript + Svelte validation
```

**Biome config** in `biome.json`:
- Tab indentation (width 2)
- Single quotes
- Semicolons required
- Svelte files: many rules disabled (false positives)

### Testing Changes

Use example files in `examples/chats/`:
- `private-chat/` - Individual chat with audio
- `family-group-chat/` - Group chat

Create test ZIPs: `cd examples/chats && ./build-zips.sh`

## Release Process

**Automated workflow** - see `RELEASE.md` for full documentation.

### Commit Convention (Semantic Release)

```
feat: add bookmark export        # Minor version (1.0.0 → 1.1.0)
fix: resolve search crash        # Patch version (1.0.0 → 1.0.1)
perf: optimize parser            # Patch version
docs: update README              # No release
chore: upgrade dependencies      # No release
```

Merging to `main` triggers:
1. **Semantic Release** (version, changelog, GitHub release)
2. **Build Workflow** (Electron binaries for macOS/Windows/Linux)
3. **Deploy Workflow** (GitHub Pages)

Never manually edit `CHANGELOG.md` or `package.json` version.

## Component Patterns

### Props with `$props()` Rune

```svelte
<script lang="ts">
interface Props {
  message: string;
  count?: number;  // Optional with default
}

let { message, count = 0 }: Props = $props();
</script>
```

### Event Handlers (Not `createEventDispatcher`)

```svelte
<script lang="ts">
interface Props {
  onSelect: (id: string) => void;
}

let { onSelect }: Props = $props();
</script>

<button onclick={() => onSelect('123')}>Click</button>
```

### Snippets for Composition

```svelte
{#snippet header()}
  <h1>Title</h1>
{/snippet}

{@render header()}
```

## Performance Optimizations

### Search Performance

- **Bitmap-based matching**: `Uint8Array` bitmap instead of `Set<string>` for 10k+ results
- **Debounced search**: 150ms debounce on input
- **Progressive results**: First 200 results returned immediately, rest ignored
- **Worker-based indexing**: Main thread never blocks

See `src/lib/state.svelte.ts` for `searchMatchBitmap` implementation.

### Virtual Scrolling

ChatView renders visible messages only. Uses `flatItems` array with date headers:

```typescript
type FlatItem = 
  | { type: 'date'; date: Date }
  | { type: 'message'; message: ChatMessage };
```

## Common Patterns

### Auto-Update Checker (Electron only)

`src/lib/update-checker.svelte.ts` checks GitHub releases API:
```typescript
if (isElectron) {
  initUpdateChecker();  // Polls on startup, every 6h
}
```

Shows `<UpdateToast>` when new version available. Manual download (no auto-update).

### Theme Detection

```svelte
<script>
import { browser } from '$app/environment';

let isDark = $state(false);

$effect(() => {
  if (browser) {
    isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
});
</script>
```

### Electron IPC

```javascript
// electron/preload.cjs
contextBridge.exposeInMainWorld('electronAPI', {
  getVersion: () => app.getVersion(),
  openExternal: (url) => shell.openExternal(url)
});
```

```typescript
// Component
const version = window.electronAPI?.getVersion();
```

## Critical Don'ts

- ❌ **Don't** use Svelte 4 stores (`writable`, `derived`, `readable`)
- ❌ **Don't** mutate state directly: `items.push(x)` → use `items = [...items, x]`
- ❌ **Don't** use `createEventDispatcher` → use callback props
- ❌ **Don't** hardcode strings → use `m.key()` from paraglide
- ❌ **Don't** run heavy operations on main thread → use workers
- ❌ **Don't** add external API calls → violates privacy promise
- ❌ **Don't** use ESLint → project uses Biome

## File Organization

```
src/
├── lib/
│   ├── components/        # Reusable Svelte components
│   ├── parser/            # WhatsApp format parsing
│   ├── workers/           # Web Workers for heavy tasks
│   ├── state.svelte.ts    # Main app state (runes)
│   ├── bookmarks.svelte.ts
│   └── transcription.svelte.ts
├── routes/
│   ├── +page.svelte       # Main app UI
│   └── +layout.svelte     # App wrapper
└── paraglide/             # Generated i18n code (don't edit)

electron/
├── main.cjs               # Electron main process
└── preload.cjs            # Context bridge

messages/                  # i18n source files (10 languages)
examples/                  # Test data for development
.github/workflows/         # CI/CD automation
```

## References

- Svelte 5 Docs: https://svelte.dev/docs/svelte/$state
- Release Process: `RELEASE.md`
- Contributing: `CONTRIBUTING.md`
- Privacy Policy: `README.md` (Privacy & Security section)
