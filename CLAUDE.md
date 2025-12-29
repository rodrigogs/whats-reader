# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WhatsApp Backup Reader - a hybrid SvelteKit + Electron app for parsing and viewing WhatsApp chat exports offline. Runs as both a web app (GitHub Pages) and desktop app.

**Core principles**: 100% offline, privacy-first (no external API calls), all processing client-side.

## Development Commands

```bash
# Development
npm run dev              # Web app on localhost:5173
npm run electron:dev     # Electron app (runs Vite + Electron concurrently)

# Build
npm run build            # SvelteKit build → build/
npm run electron:build   # Build + Electron packaging → dist-electron/

# Code quality
npm run lint             # Biome check (NOT ESLint)
npm run lint:fix         # Auto-fix lint issues
npm run format           # Format with Biome
npm run check            # TypeScript + Svelte validation

# i18n
npm run machine-translate  # Auto-translate with inlang
```

## Architecture

### State Management (Svelte 5 Runes Only)

This project uses **Svelte 5 runes exclusively**. Never use Svelte 4 stores (`writable`, `derived`, `readable`).

State lives in `*.svelte.ts` files using factory functions:
- `src/lib/state.svelte.ts` - Main app state
- `src/lib/bookmarks.svelte.ts` - Bookmark management
- `src/lib/transcription.svelte.ts` - Audio transcription state
- `src/lib/gallery.svelte.ts` - Media gallery state

Key patterns:
- Use `$state`, `$derived`, `$effect` runes
- Never mutate state directly: `items = [...items, x]` not `items.push(x)`
- Use `$props()` for component props, not `export let`
- Use callback props for events, not `createEventDispatcher`

### Web Workers

Heavy operations run in workers to avoid blocking main thread:
- `src/lib/workers/index-worker.ts` - Search index building
- `src/lib/workers/search-worker.ts` - Search queries with progress

### Internationalization

Uses Paraglide JS (compile-time i18n). Source files in `messages/`. Never hardcode user-facing strings.

```svelte
<script>
import * as m from '$lib/paraglide/messages';
</script>
<input placeholder={m.search_placeholder()} />
```

To add translations: add key to `messages/en.json`, run `npm run machine-translate`.

### Dual-Target Builds

- **Web**: Base path `/whats-reader` for GitHub Pages (when `GITHUB_PAGES=true`)
- **Electron**: Relative paths (`base: './'`) for `file://` loading

Electron files: `electron/main.cjs`, `electron/preload.cjs`

## Code Style (Biome)

- Tab indentation (width 2)
- Single quotes
- Semicolons required
- Many rules disabled for `.svelte` files due to false positives

## Testing

Use example files in `examples/chats/` for testing:
- `private-chat/` - Individual chat with audio
- `family-group-chat/` - Group chat

Create test ZIPs: `cd examples/chats && ./build-zips.sh`

## Commit Convention (Semantic Release)

```
feat: ...    # Minor version bump
fix: ...     # Patch version bump
perf: ...    # Patch version bump
docs: ...    # No release
chore: ...   # No release
```

Merging to `main` triggers semantic-release, builds, and GitHub Pages deploy.
Never manually edit `CHANGELOG.md` or `package.json` version.

## Critical Rules

- **No external API calls** - violates privacy promise
- **No Svelte 4 stores** - use runes only
- **No ESLint** - project uses Biome
- **No hardcoded strings** - use paraglide `m.key()`
- **No heavy main-thread operations** - use workers
