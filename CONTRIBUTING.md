# Contributing to WhatsApp Backup Reader

Thank you for your interest in contributing to WhatsApp Backup Reader! This document provides guidelines and information for contributors.

## 🌿 Branch Strategy

We use a two-branch workflow:

- **`main`** - Production branch. Releases are automatically created when changes are pushed here.
- **`dev`** - Development branch. All feature branches and PRs should target this branch.

### Workflow

1. Fork the repository
2. Create a feature branch from `dev`: `git checkout -b feat/my-feature dev`
3. Make your changes
4. Push to your fork
5. Open a Pull Request targeting the `dev` branch
6. After review and approval, your PR will be merged to `dev`
7. Periodically, `dev` is merged to `main`, triggering an automatic release

## 📝 Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org/) for automatic versioning and changelog generation.

### Format

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Types

| Type | Description | Version Bump |
|------|-------------|--------------|
| `feat` | A new feature | Minor (0.x.0) |
| `fix` | A bug fix | Patch (0.0.x) |
| `perf` | Performance improvement | Patch |
| `refactor` | Code change that neither fixes a bug nor adds a feature | Patch |
| `docs` | Documentation only changes | None |
| `style` | Changes that do not affect the meaning of the code | None |
| `test` | Adding missing tests or correcting existing tests | None |
| `chore` | Changes to the build process or auxiliary tools | None |
| `ci` | Changes to CI configuration files and scripts | None |

### Breaking Changes

For breaking changes, add `!` after the type or include `BREAKING CHANGE:` in the footer:

```
feat!: remove deprecated API endpoint

BREAKING CHANGE: The /api/v1/chat endpoint has been removed. Use /api/v2/chat instead.
```

Breaking changes trigger a **major** version bump (x.0.0).

### Examples

```bash
# Feature
git commit -m "feat(parser): add support for voice message transcription"

# Bug fix
git commit -m "fix(ui): correct chat bubble alignment on mobile"

# Performance
git commit -m "perf(search): optimize message search algorithm"

# Documentation
git commit -m "docs: update README with new installation steps"

# Chore
git commit -m "chore(deps): update electron to v39"
```

## 🛠️ Development Setup

### Prerequisites

- Node.js 22+
- npm 10+

### Getting Started

```bash
# Clone the repository
git clone https://github.com/rodrigogs/whats-reader.git
cd whats-reader

# Install dependencies
npm install

# Run in development mode (web)
npm run dev

# Run in development mode (Electron)
npm run electron:dev
```

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run electron:dev` | Start Electron in development mode |
| `npm run electron:build` | Build Electron app for current platform |
| `npm run lint` | Run linter |
| `npm run lint:fix` | Fix linting issues |
| `npm run check` | Run type checking |

## 🧪 Testing

Before submitting a PR, ensure:

1. **Linting passes**: `npm run lint`
2. **Type checking passes**: `npm run check`
3. **Build succeeds**: `npm run build`

## 📦 Release Process

Releases are fully automated:

1. When `dev` is merged to `main`, the release workflow runs
2. [semantic-release](https://semantic-release.gitbook.io/) analyzes commits since the last release
3. Version is automatically bumped based on commit types
4. CHANGELOG.md is updated
5. A GitHub Release is created
6. The build workflow creates binaries for all platforms:
   - macOS (Intel & Apple Silicon)
   - Windows (x64 & ARM64)
   - Linux (x64)

## 🐛 Reporting Bugs

When reporting bugs, please include:

- Operating system and version
- App version
- Steps to reproduce
- Expected behavior
- Actual behavior
- Screenshots if applicable

## 💡 Feature Requests

Feature requests are welcome! Please:

1. Check existing issues to avoid duplicates
2. Describe the feature and its use case
3. Explain why it would benefit users

## 📄 License

By contributing to WhatsApp Backup Reader, you agree that your contributions will be licensed under the [AGPL-3.0 License](LICENSE).

## 🙏 Thank You!

Your contributions make this project better for everyone. We appreciate your time and effort!
