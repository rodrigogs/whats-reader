## [1.16.2](https://github.com/rodrigogs/whats-reader/compare/v1.16.1...v1.16.2) (2025-12-14)


### Bug Fixes

* add retry logic with npm ci for reliable dependency installation ([0ddb07e](https://github.com/rodrigogs/whats-reader/commit/0ddb07e47a983bcfd20b291c33eb5fae505f5e46))

## [1.16.1](https://github.com/rodrigogs/whats-reader/compare/v1.16.0...v1.16.1) (2025-12-11)


### Bug Fixes

* apply biome lint fixes for template literals ([cc7740a](https://github.com/rodrigogs/whats-reader/commit/cc7740a35fea4c3fe7db7f23224a4611a9e3da54))

# [1.16.0](https://github.com/rodrigogs/whats-reader/compare/v1.15.9...v1.16.0) (2025-12-11)


### Features

* improve update dialog with ignore version and never ask options ([068e65e](https://github.com/rodrigogs/whats-reader/commit/068e65e56dbed0f45a9fa590dd3f9d6db29a9fb6))

## [1.15.9](https://github.com/rodrigogs/whats-reader/compare/v1.15.8...v1.15.9) (2025-12-11)


### Bug Fixes

* improve afterPack logging to show architecture ([859e187](https://github.com/rodrigogs/whats-reader/commit/859e187a32f087a516324b9f234a66bf7dc1ff76))

## [1.15.8](https://github.com/rodrigogs/whats-reader/compare/v1.15.7...v1.15.8) (2025-12-11)


### Bug Fixes

* regenerate package-lock.json after removing postinstall script ([d69043d](https://github.com/rodrigogs/whats-reader/commit/d69043d6d9e142b297b479d9f721db0407244bdb))


### Performance Improvements

* use afterPack hook to remove onnxruntime-node (saves 141MB) ([0c91df3](https://github.com/rodrigogs/whats-reader/commit/0c91df3c8f5cd553e8884ebd9214bee918444b35))

## [1.15.7](https://github.com/rodrigogs/whats-reader/compare/v1.15.6...v1.15.7) (2025-12-11)


### Performance Improvements

* optimize electron build size by removing onnxruntime-node (saves 210MB) ([3e75ddd](https://github.com/rodrigogs/whats-reader/commit/3e75ddd6d533b66143b563935f926c182823d046))

## [1.15.6](https://github.com/rodrigogs/whats-reader/compare/v1.15.5...v1.15.6) (2025-12-11)


### Bug Fixes

* include dependencies in electron build to resolve module not found errors ([b8335a2](https://github.com/rodrigogs/whats-reader/commit/b8335a2d77d42d97caa61b29bb51d19c7d1e95fc))

## [1.15.5](https://github.com/rodrigogs/whats-reader/compare/v1.15.4...v1.15.5) (2025-12-11)


### Bug Fixes

* final verification of asset consistency ([7d1e0d0](https://github.com/rodrigogs/whats-reader/commit/7d1e0d09299651603e51009845d446db41c86966))

## [1.15.4](https://github.com/rodrigogs/whats-reader/compare/v1.15.3...v1.15.4) (2025-12-11)


### Bug Fixes

* test build with CUDA skip configuration ([f24cd55](https://github.com/rodrigogs/whats-reader/commit/f24cd5543f362fb88b21a03f806cdda0c70d8020))

## [1.15.3](https://github.com/rodrigogs/whats-reader/compare/v1.15.2...v1.15.3) (2025-12-11)


### Bug Fixes

* skip CUDA binaries for onnxruntime to prevent CDN timeouts ([7e94061](https://github.com/rodrigogs/whats-reader/commit/7e94061d39474c3482614c22d9209080f5d1fca8))

## [1.15.2](https://github.com/rodrigogs/whats-reader/compare/v1.15.1...v1.15.2) (2025-12-11)


### Bug Fixes

* retry build to verify asset consistency ([fd916da](https://github.com/rodrigogs/whats-reader/commit/fd916dae89a467c61db199150912e86d27a24629))

## [1.15.1](https://github.com/rodrigogs/whats-reader/compare/v1.15.0...v1.15.1) (2025-12-11)


### Bug Fixes

* verify asset generation consistency ([2468e16](https://github.com/rodrigogs/whats-reader/commit/2468e16a8d2311a534a740e3d6dc678b2e7d88a9))

# [1.15.0](https://github.com/rodrigogs/whats-reader/compare/v1.14.1...v1.15.0) (2025-12-11)


### Features

* verify consistent asset generation across releases ([1d4b549](https://github.com/rodrigogs/whats-reader/commit/1d4b549516da6bf7cbb280d1d4b56da61b7838dc))

## [1.14.1](https://github.com/rodrigogs/whats-reader/compare/v1.14.0...v1.14.1) (2025-12-11)


### Bug Fixes

* prevent premature release publishing by keeping draft status ([9c94b7f](https://github.com/rodrigogs/whats-reader/commit/9c94b7fa51c2a32c49647d34266f9b0a0dd0d82e))

# [1.14.0](https://github.com/rodrigogs/whats-reader/compare/v1.13.4...v1.14.0) (2025-12-11)


### Features

* validate and test complete draft-first release workflow ([c2a4397](https://github.com/rodrigogs/whats-reader/commit/c2a4397d469a7edda0c6e9375a0aa60f6fb103f5))

## [1.13.4](https://github.com/rodrigogs/whats-reader/compare/v1.13.3...v1.13.4) (2025-12-11)


### Bug Fixes

* remove AppImage target due to unreliable CDN downloads ([6c41ee9](https://github.com/rodrigogs/whats-reader/commit/6c41ee9fcb67aaad5c7a4f3eb46c6a408ce3098e))

## [1.13.3](https://github.com/rodrigogs/whats-reader/compare/v1.13.2...v1.13.3) (2025-12-11)


### Bug Fixes

* add retry logic with npm ci for reliable dependency installation ([c394cb1](https://github.com/rodrigogs/whats-reader/commit/c394cb16452a4a3e0ec2eb2ed9abd46d6f15db47))

## [1.13.2](https://github.com/rodrigogs/whats-reader/compare/v1.13.1...v1.13.2) (2025-12-11)

## [1.13.1](https://github.com/rodrigogs/whats-reader/compare/v1.13.0...v1.13.1) (2025-12-11)


### Bug Fixes

* add retry logic for npm install to handle CDN failures ([970bd9e](https://github.com/rodrigogs/whats-reader/commit/970bd9e72fde45688a658cce2e432bedf836bdbd))
* add retry logic to release workflow npm install ([214862b](https://github.com/rodrigogs/whats-reader/commit/214862bc666410a97255359517dffe3cdcbe8aac))

# [1.13.0](https://github.com/rodrigogs/whats-reader/compare/v1.12.3...v1.13.0) (2025-12-11)


### Bug Fixes

* add GH_TOKEN env var to electron-builder steps ([11e73a1](https://github.com/rodrigogs/whats-reader/commit/11e73a16f2b5411f04b86ab1290d203fe7c531c2))


### Features

* create releases as drafts, publish only after all assets are uploaded ([6eaa902](https://github.com/rodrigogs/whats-reader/commit/6eaa902e9f6c106affacc539b53214a5ccbcf1d4))

## [1.12.3](https://github.com/rodrigogs/whats-reader/compare/v1.12.2...v1.12.3) (2025-12-11)


### Bug Fixes

* ensure auto-updater metadata files are uploaded to releases ([ababfa3](https://github.com/rodrigogs/whats-reader/commit/ababfa34742d6f2aa0b881dc33c9d655b0a950aa))

## [1.12.2](https://github.com/rodrigogs/whats-reader/compare/v1.12.1...v1.12.2) (2025-12-11)


### Bug Fixes

* add GH_TOKEN env var to electron-builder steps ([2eea66a](https://github.com/rodrigogs/whats-reader/commit/2eea66ad218a34ada2710e1d71ce2fc03ab607e1))

## [1.12.1](https://github.com/rodrigogs/whats-reader/compare/v1.12.0...v1.12.1) (2025-12-11)


### Bug Fixes

* remove invalid compressionLevel from NSIS config ([8688228](https://github.com/rodrigogs/whats-reader/commit/868822891d5ed45d125d991f4cfd3ca36a47093e))

# [1.12.0](https://github.com/rodrigogs/whats-reader/compare/v1.11.1...v1.12.0) (2025-12-11)


### Bug Fixes

* resolve TypeScript and lint errors in auto-updater implementation ([181797b](https://github.com/rodrigogs/whats-reader/commit/181797b1f9f362527f23d0139f8b532dda4a8f9b))
* use npm install instead of npm ci to avoid lock file sync issues ([1da401c](https://github.com/rodrigogs/whats-reader/commit/1da401c932dc9dbb977f231733c6097d2e7337b9))


### Features

* implement true auto-update with electron-updater, optimize build pipeline, reduce Windows binary size ([53b9197](https://github.com/rodrigogs/whats-reader/commit/53b91971a99265a96dcc2d93f4bedff3a9dd0f61))

## [1.11.1](https://github.com/rodrigogs/whats-reader/compare/v1.11.0...v1.11.1) (2025-12-11)


### Bug Fixes

* add actions write permission to release workflow for build triggering ([90c3348](https://github.com/rodrigogs/whats-reader/commit/90c3348755313d2a3993ea11a1d4b499b547e61e))

# [1.11.0](https://github.com/rodrigogs/whats-reader/compare/v1.10.0...v1.11.0) (2025-12-11)


### Bug Fixes

* trigger build workflow after semantic release ([bd96c83](https://github.com/rodrigogs/whats-reader/commit/bd96c83ea713aee284cba30e0c96c3ef422e7742))


### Features

* add auto-update checker with version badge and toast notification ([977afbf](https://github.com/rodrigogs/whats-reader/commit/977afbf091c62dfe0649b8d0a4e776d184b8fd10))

# [1.10.0](https://github.com/rodrigogs/whats-reader/compare/v1.9.0...v1.10.0) (2025-12-10)


### Features

* complete Spanish, Portuguese, German, French README translations ([12b6523](https://github.com/rodrigogs/whats-reader/commit/12b6523a7d2652fbcdae8ae40f7c53c7d9d6f19f))
* synchronize all README translations with complete content matching README.md structure ([75ce077](https://github.com/rodrigogs/whats-reader/commit/75ce077168db51f3d36b60c93bc75005d6b442ea))

# [1.9.0](https://github.com/rodrigogs/whats-reader/compare/v1.8.0...v1.9.0) (2025-12-10)


### Features

* complete all README translations with full content matching README.md structure ([0086b90](https://github.com/rodrigogs/whats-reader/commit/0086b90d62748c2712e9d08e9b7b4859671a99f9))

# [1.8.0](https://github.com/rodrigogs/whats-reader/compare/v1.7.1...v1.8.0) (2025-12-10)


### Features

* add missing README translations for Italian, Dutch, Japanese, Chinese, and Russian ([5f0f2bf](https://github.com/rodrigogs/whats-reader/commit/5f0f2bfbea62fb84b179252d6ed87e17af83b8de))

## [1.7.1](https://github.com/rodrigogs/whats-reader/compare/v1.7.0...v1.7.1) (2025-12-10)


### Bug Fixes

* apply biome formatting to bookmarks panel ([1791533](https://github.com/rodrigogs/whats-reader/commit/17915331f6afe0bb9bb8886f239ea48e1392ec59))
* resolve TypeScript type error with LocalizedString concatenation ([6e9d6a4](https://github.com/rodrigogs/whats-reader/commit/6e9d6a48a04c01f6b73b737a500257110710a176))

# [1.7.0](https://github.com/rodrigogs/whats-reader/compare/v1.6.0...v1.7.0) (2025-12-10)


### Features

* add missing translations for bookmarks and loading states ([#10](https://github.com/rodrigogs/whats-reader/issues/10)) ([4c5db28](https://github.com/rodrigogs/whats-reader/commit/4c5db2872cf5c03f1d919f254ebba4d58c6c4010))

# [1.6.0](https://github.com/rodrigogs/whats-reader/compare/v1.5.4...v1.6.0) (2025-12-10)


### Features

* add multi-language support and enhanced parser ([591084a](https://github.com/rodrigogs/whats-reader/commit/591084aa53eca16a745019e03b54de14faaf469c))

# [1.5.0](https://github.com/rodrigogs/whats-reader/compare/v1.4.1...v1.5.0) (2025-12-09)


### Bug Fixes

* **ui:** make empty state page scrollable on small screens ([802123e](https://github.com/rodrigogs/whats-reader/commit/802123e460e983643cd36a72aacb1cd787d04b94))


### Features

* redesign export instructions as collapsible accordion ([d637cd8](https://github.com/rodrigogs/whats-reader/commit/d637cd82b21058f64e5c12987083e41bf43e56c9))

## [1.4.1](https://github.com/rodrigogs/whats-reader/compare/v1.4.0...v1.4.1) (2025-12-09)


### Bug Fixes

* enable automatic changelog updates ([82352c3](https://github.com/rodrigogs/whats-reader/commit/82352c3d2eb4130c44fca10e995c7384dd0ea11c))

# Changelog

All notable changes to this project will be documented in this file.

# [1.4.0](https://github.com/rodrigogs/whats-reader/compare/v1.3.3...v1.4.0) (2025-12-09)

### ✨ Features

* redesign export instructions as collapsible accordion ([#8](https://github.com/rodrigogs/whats-reader/issues/8)) ([c6e1bd8](https://github.com/rodrigogs/whats-reader/commit/c6e1bd8009678d5bb8c471333bab193febdd4de6))

## [1.3.3](https://github.com/rodrigogs/whats-reader/compare/v1.3.2...v1.3.3) (2025-12-09)

### 🐛 Bug Fixes

* trigger build workflow after release ([4d4ef5a](https://github.com/rodrigogs/whats-reader/commit/4d4ef5aeafcebb86347551778344d83c563dbd17))

## [1.3.2](https://github.com/rodrigogs/whats-reader/compare/v1.3.1...v1.3.2) (2025-12-09)

### 🐛 Bug Fixes

* restore changelog and git plugins to semantic-release ([3e1fb9a](https://github.com/rodrigogs/whats-reader/commit/3e1fb9afd95d99e48f808cf8fa2392337cf4fd13))

## [1.3.1](https://github.com/rodrigogs/whats-reader/compare/v1.3.0...v1.3.1) (2025-12-09)

### 🐛 Bug Fixes

* **Search freeze resolved**: Removed MiniSearch to eliminate ~5-10MB postMessage serialization that was freezing the browser
* **Scroll to search results**: Added retry mechanism for scrolling to results (fixes system notification messages)
* **TypeScript errors**: Fixed duplicate type identifiers and postMessage signatures in workers

### ✨ Improvements

* **Simplified search**: Uses fast \`string.includes()\` with bitmap results for O(1) match lookup
* **Better UI**: Replaced floating hamburger button with discrete header toggle icon
* **Cleaner code**: Unified duplicate types, removed outdated MiniSearch references

### ♻️ Refactoring

* Unified \`SerializedMessage\` and \`FlatItem\` types in index-worker
* Renamed \`WorkerInput\` to unique names per worker to avoid conflicts
* Removed ~65 lines of hamburger CSS animations

# [1.3.0](https://github.com/rodrigogs/whats-reader/compare/v1.2.4...v1.3.0) (2025-12-08)

### 🐛 Bug Fixes

* add changelog and git plugins to semantic-release ([a78c934](https://github.com/rodrigogs/whats-reader/commit/a78c93462f1f120ade3f085582b47c02df255fee))
* remove git plugin from semantic-release (conflicts with branch protection) ([54e21dc](https://github.com/rodrigogs/whats-reader/commit/54e21dc45cbf51de7f4b8a3add3dcaafc63938c1))

### ✨ Features

* use browser preferred language as default locale ([ea19ea8](https://github.com/rodrigogs/whats-reader/commit/ea19ea8de75ac7ec3eb65600e9798889ad89916e))

## [1.2.4](https://github.com/rodrigogs/whats-reader/compare/v1.2.3...v1.2.4) (2025-12-08)

### 🐛 Bug Fixes

* update package.json version in build workflow before building ([49a6978](https://github.com/rodrigogs/whats-reader/commit/49a6978ad62a959e51f98ddde5058e255bdab0af))

## [1.2.3](https://github.com/rodrigogs/whats-reader/compare/v1.2.2...v1.2.3) (2025-12-08)

### 🐛 Bug Fixes

* add npm plugin to semantic-release to update package.json version ([a30492f](https://github.com/rodrigogs/whats-reader/commit/a30492faad3b1f49673056e8cf1d31c74998a52c))

## [1.2.2](https://github.com/rodrigogs/whats-reader/compare/v1.2.1...v1.2.2) (2025-12-08)

### 🐛 Bug Fixes

* update CI badge to use dev branch ([db945ee](https://github.com/rodrigogs/whats-reader/commit/db945ee2c7c4e7dd7dbc79b77ffe9d1f3625c4fa))

## [1.2.1](https://github.com/rodrigogs/whats-reader/compare/v1.2.0...v1.2.1) (2025-12-08)

### 🐛 Bug Fixes

* improve empty state settings buttons positioning ([372a740](https://github.com/rodrigogs/whats-reader/commit/372a7408ba77f242feb7d5b0a32a2faa28365020))

# [1.2.0](https://github.com/rodrigogs/whats-reader/compare/v1.1.6...v1.2.0) (2025-12-08)

### ✨ Features

* add FlatItem types for precomputed message indexing ([b002fb5](https://github.com/rodrigogs/whats-reader/commit/b002fb56f32d2c27ffeba9baeb25e29bab5f2053))
* merge bookmarks on import instead of replacing ([26fb943](https://github.com/rodrigogs/whats-reader/commit/26fb943da1bc15c1caa08a5434c7249b277b9b3b))

### ⚡ Performance Improvements

* precompute message index via web worker for faster navigation ([4bb036e](https://github.com/rodrigogs/whats-reader/commit/4bb036e3bbd3fbcabe821998ed8bbd3d82036db5))

## [1.1.6](https://github.com/rodrigogs/whats-reader/compare/v1.1.5...v1.1.6) (2025-12-08)

### 🐛 Bug Fixes

* regenerate package-lock.json for Node.js 24 compatibility ([cce6493](https://github.com/rodrigogs/whats-reader/commit/cce6493d25e8ff7505224aec87c4a15afdbb276e))

## [1.1.5](https://github.com/rodrigogs/whats-reader/compare/v1.1.4...v1.1.5) (2025-12-08)

### ⚡ Performance Improvements

* optimize binary size by excluding unnecessary node_modules ([ffab963](https://github.com/rodrigogs/whats-reader/commit/ffab96378c02117346153e62a2f2f606e6521214))

## [1.1.4](https://github.com/rodrigogs/whats-reader/compare/v1.1.3...v1.1.4) (2025-12-08)

### 🐛 Bug Fixes

* make language and dark mode buttons fixed position at top-right ([d8d6e5e](https://github.com/rodrigogs/whats-reader/commit/d8d6e5e1525f1acbc0df9499e86892f0c86f1ec0))

## [1.1.3](https://github.com/rodrigogs/whats-reader/compare/v1.1.2...v1.1.3) (2025-12-08)

### 🐛 Bug Fixes

* reload page on locale change for proper UI update ([41c032d](https://github.com/rodrigogs/whats-reader/commit/41c032dcc81a6928697372b24434079268b1f01e))

## [1.1.2](https://github.com/rodrigogs/whats-reader/compare/v1.1.1...v1.1.2) (2025-12-08)

### 🐛 Bug Fixes

* language switching and fixed position for settings buttons ([33ef476](https://github.com/rodrigogs/whats-reader/commit/33ef4764febe2ac2e6c0aaf6d247cfc25f7eb87a))

## [1.1.1](https://github.com/rodrigogs/whats-reader/compare/v1.1.0...v1.1.1) (2025-12-08)

### 🐛 Bug Fixes

* configure base path for GitHub Pages deployment ([c77c8f3](https://github.com/rodrigogs/whats-reader/commit/c77c8f31fbdce40bfcaf5bacccbf9c8d168d47fb))

# [1.1.0](https://github.com/rodrigogs/whats-reader/compare/v1.0.2...v1.1.0) (2025-12-08)

### 🐛 Bug Fixes

* remove git plugin from semantic-release to avoid branch protection issues ([defa594](https://github.com/rodrigogs/whats-reader/commit/defa59476790808df315d5dcbcdb173ff239f679))

### ✨ Features

* add support for all OS architectures in releases ([5e76828](https://github.com/rodrigogs/whats-reader/commit/5e76828dcc9ce28d643497524339892dacd02029))

## [1.0.2](https://github.com/rodrigogs/whats-reader/compare/v1.0.1...v1.0.2) (2025-12-08)

### 🐛 Bug Fixes

* update electron:dev script to use cross-env for setting NODE_ENV ([65a1683](https://github.com/rodrigogs/whats-reader/commit/65a1683e4b5620da8e3b8ac0f53fedc88fb26260))

## [1.0.1](https://github.com/rodrigogs/whats-reader/compare/v1.0.0...v1.0.1) (2025-12-08)

### 🐛 Bug Fixes

* add author email for deb builds and disable electron-builder auto-publish ([25fd8cb](https://github.com/rodrigogs/whats-reader/commit/25fd8cb64b0dd2c24cbc7f110b904e58ee8d4b6f))

# 1.0.0 (2025-12-08)

### 🐛 Bug Fixes

* address code review feedback - prevent infinite loop and SSR check ([35cefe4](https://github.com/rodrigogs/whats-reader/commit/35cefe40a8986e406ac5f5607b1dd36e178a3996))
* address PR review comments - improve code quality and fix bugs ([0afaa83](https://github.com/rodrigogs/whats-reader/commit/0afaa8324700e2222a5d0699bbe17de3dc0e7c49))
* bookmark navigation and collapsible sidebar improvements ([40a3f02](https://github.com/rodrigogs/whats-reader/commit/40a3f02e015daf90f66811e219101d94fc7d9812))
* improve favicon/PWA setup per best practices ([ecb4a0b](https://github.com/rodrigogs/whats-reader/commit/ecb4a0b9ec3239b745eb8047e28d75e8b784dd71))
* macOS dock icon with proper rounded corners and padding ([2c8df2a](https://github.com/rodrigogs/whats-reader/commit/2c8df2a6f6dc876d5aa534644b2fe7806f3bab90))
* only show electron titlebar drag region on macOS ([4e5bf73](https://github.com/rodrigogs/whats-reader/commit/4e5bf73046553a3b4624891c3ab8639a117563b8))
* remove duplicate electron-drag bars causing chunky headers ([95d27d9](https://github.com/rodrigogs/whats-reader/commit/95d27d91f3dedf19d9cd5d232b560733721342e9))
* use custom protocol for Electron production builds ([5cf7865](https://github.com/rodrigogs/whats-reader/commit/5cf786513fc57ad43c2b16905bd6553c35abdaad))

### ✨ Features

* add app icons, favicon, and PWA manifest ([19384c0](https://github.com/rodrigogs/whats-reader/commit/19384c0d10739c3641f0024d02f76711d7096707))
* add audio transcription with Web Worker, auto-load media, and floating menus ([754d31e](https://github.com/rodrigogs/whats-reader/commit/754d31eb7fd0ee81a9dbccba4eb3b7f57cb3a79f))
* add i18n with Paraglide JS and UI improvements ([bbe45bd](https://github.com/rodrigogs/whats-reader/commit/bbe45bdf1757fd215ffc66026609f0da98b314bf))
* add message bookmarks with comments ([bf61c67](https://github.com/rodrigogs/whats-reader/commit/bf61c6787a179b3e91c89d310eb8cac0ac91e611))
* **i18n:** complete translation coverage for all UI strings ([f5fc8a3](https://github.com/rodrigogs/whats-reader/commit/f5fc8a320d2bf840ef3f9f32b544f5df53565c30))
* improve search UX and progress indicators ([0eab2f7](https://github.com/rodrigogs/whats-reader/commit/0eab2f727d5a992a0dd6c728b2a00c41aa7bf5db))
