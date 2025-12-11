# Release Process Documentation

This document describes the automated release workflow for WhatsApp Backup Reader.

## 📋 Overview

The release process follows a **straight-line workflow** from development to production:

```
dev branch → main branch → Semantic Release → Build → GitHub Pages Deploy
```

## 🔄 Workflow Pipeline

### 1. Development Phase (CI)

**Trigger**: Push to `dev` branch or Pull Request to `dev`/`main`

**Workflow**: `.github/workflows/ci.yml`

**Jobs**:
- ✅ **Lint**: Code quality checks with Biome
- 🔍 **Type Check**: TypeScript validation
- 🏗️ **Build**: Verify SvelteKit build succeeds

**Purpose**: Quality gates before merging to main

---

### 2. Release Phase (Semantic Release)

**Trigger**: Push to `main` branch (usually via merge from `dev`)

**Workflow**: `.github/workflows/release.yml`

**Steps**:
1. Analyze commit messages since last release
2. Determine next version based on commit types (see [Versioning](#versioning))
3. Generate `CHANGELOG.md`
4. Update `package.json` version
5. Create Git tag
6. Create GitHub release with changelog
7. **Trigger Build Workflow** with new version

**Configuration**: `.releaserc.json`

---

### 3. Build Phase (Electron Binaries)

**Trigger**: 
- Automatically triggered by Release workflow
- Manual dispatch with version input
- Tag pushes matching `v*`
- Release published events

**Workflow**: `.github/workflows/build.yml`

**Matrix Strategy** (parallel builds):
- 🍎 **macOS**: `macos-latest`
- 🪟 **Windows**: `windows-latest`
- 🐧 **Linux**: `ubuntu-latest`

**Artifacts per platform**:

| Platform | Architectures | Outputs |
|----------|--------------|---------|
| macOS | x64, arm64 | `.dmg`, `.zip` |
| Windows | x64, arm64 | `.exe` (NSIS installer), `.exe` (portable) |
| Linux | x64, arm64 | `.AppImage`, `.deb`, `.rpm` |

**Upload targets**:
- ✅ GitHub Release (permanent)
- ✅ Workflow Artifacts (7-day retention)

---

### 4. Deploy Phase (GitHub Pages)

**Trigger**: Push to `main` branch

**Workflow**: `.github/workflows/deploy.yml`

**Steps**:
1. Build SvelteKit static site
2. Upload to GitHub Pages
3. Deploy to production

**Live URL**: Configured in repository settings

---

## 📝 Versioning

Follows **Semantic Versioning** (`MAJOR.MINOR.PATCH`) with Angular commit conventions:

| Commit Type | Example | Version Bump | Appears in Changelog |
|-------------|---------|--------------|---------------------|
| `feat:` | `feat: add dark mode` | **MINOR** (1.0.0 → 1.1.0) | ✅ ✨ Features |
| `fix:` | `fix: resolve crash on startup` | **PATCH** (1.0.0 → 1.0.1) | ✅ 🐛 Bug Fixes |
| `perf:` | `perf: optimize image loading` | **PATCH** | ✅ ⚡ Performance |
| `refactor:` | `refactor: simplify parser logic` | **PATCH** | ✅ ♻️ Refactoring |
| `docs:` | `docs: update README` | No release | ❌ |
| `style:` | `style: format code` | No release | ❌ |
| `chore:` | `chore: update dependencies` | No release | ❌ |
| `test:` | `test: add unit tests` | No release | ❌ |
| `ci:` | `ci: update workflow` | No release | ❌ |

### Breaking Changes

Use `BREAKING CHANGE:` in commit footer to trigger **MAJOR** version bump:

```
feat: redesign UI

BREAKING CHANGE: Old themes are no longer compatible
```

This changes `1.0.0 → 2.0.0`

---

## 🚀 How to Release

### Standard Release (Recommended)

1. **Develop on `dev` branch**
   ```bash
   git checkout dev
   git pull origin dev
   ```

2. **Create feature branch**
   ```bash
   git checkout -b feat/my-feature
   ```

3. **Commit with conventional format**
   ```bash
   git commit -m "feat: add awesome feature"
   git commit -m "fix: resolve bug in parser"
   ```

4. **Push and create PR to `dev`**
   ```bash
   git push origin feat/my-feature
   ```
   - CI workflow validates code
   - Merge after approval

5. **Merge `dev` to `main`**
   ```bash
   git checkout main
   git pull origin main
   git merge dev
   git push origin main
   ```

6. **Automated process starts**:
   - ✅ Semantic Release analyzes commits
   - ✅ New version determined
   - ✅ CHANGELOG updated
   - ✅ GitHub release created
   - ✅ Build workflow triggered
   - ✅ Binaries built for all platforms
   - ✅ Assets uploaded to release
   - ✅ GitHub Pages deployed

7. **Verify release**
   ```bash
   gh release view v1.x.x
   ```

### Emergency Hotfix

For critical fixes that can't wait for normal development cycle:

```bash
git checkout main
git pull origin main
git checkout -b hotfix/critical-bug
git commit -m "fix: critical security issue"
git push origin hotfix/critical-bug
```

Create PR directly to `main` → merge → automatic release

---

## 🛠️ Manual Operations

### Trigger Build Manually

If automatic build fails or you need to rebuild:

```bash
gh workflow run build.yml --ref main -f version=1.10.0
```

Replace `1.10.0` with the version to build.

### Check Workflow Status

```bash
# List recent runs
gh run list --limit 10

# Check specific workflow
gh run list --workflow=build.yml --limit 5

# View run details
gh run view <run-id>

# Download logs
gh run download <run-id>
```

### Verify Release Assets

```bash
# View release
gh release view v1.10.0

# List assets
gh release view v1.10.0 --json assets --jq '.assets[] | .name'

# Download release
gh release download v1.10.0
```

---

## ❌ Troubleshooting

### No release created after merging to main

**Symptoms**: Push to main, but no release appears

**Causes**:
- ✋ No releasable commits (only `docs:`, `chore:`, `style:`)
- ✋ Commit message doesn't follow convention

**Solution**:
```bash
# Check recent commits
git log --oneline -5

# If needed, add a proper commit
git commit --allow-empty -m "fix: trigger release"
git push origin main
```

### Release created but no binaries

**Symptoms**: GitHub release exists but has no `.dmg`, `.exe`, etc.

**Causes**:
- ❌ Build workflow not triggered
- ❌ Build jobs failed

**Solution**:
```bash
# Check build runs
gh run list --workflow=build.yml --limit 3

# If no recent runs, trigger manually
gh workflow run build.yml --ref main -f version=<version>

# If runs failed, check logs
gh run view <run-id> --log-failed
```

### Windows/macOS/Linux binaries missing

**Symptoms**: Only some platforms have binaries in release

**Causes**:
- ❌ One or more matrix jobs failed
- ❌ Platform-specific build error

**Solution**:
```bash
# View specific run
gh run view <run-id>

# Check which jobs failed
gh run view <run-id> --log-failed

# Common fixes:
# - Check node_modules compatibility
# - Verify icon files exist (static/icon.{icns,ico,png})
# - Ensure package.json has correct build config

# Rebuild after fixing
gh workflow run build.yml --ref main -f version=<version>
```

### Build succeeds but assets not uploaded

**Symptoms**: Build workflow completes, but release has no files

**Causes**:
- ❌ Release doesn't exist yet
- ❌ Permission issues

**Solution**:
```bash
# Verify release exists
gh release view v<version>

# If not, semantic-release didn't run
# Check release workflow logs
gh run list --workflow=release.yml --limit 3

# Check permissions in .github/workflows/build.yml
# Should have: permissions: contents: write
```

---

## 📊 Release Checklist

Before merging to `main`:

- [ ] All commits follow conventional format
- [ ] CI passes on `dev` branch
- [ ] CHANGELOG manually reviewed (optional)
- [ ] Breaking changes documented
- [ ] README translations updated (if applicable)

After release:

- [ ] GitHub release created with version tag
- [ ] CHANGELOG.md updated in repository
- [ ] All platform binaries present in release assets
- [ ] GitHub Pages deployed successfully
- [ ] Test download and installation on at least one platform

---

## 🔐 Permissions

### GitHub Token (automatic)

The workflows use `GITHUB_TOKEN` automatically provided by GitHub Actions:

- **Release workflow**: `contents: write`, `issues: write`, `pull-requests: write`
- **Build workflow**: `contents: write`
- **Deploy workflow**: `contents: read`, `pages: write`, `id-token: write`

No manual token configuration needed.

---

## 📦 Build Configuration

Electron Builder settings in `package.json`:

```json
{
  "build": {
    "appId": "com.whatsapp.backup.reader",
    "productName": "WhatsApp Backup Reader",
    "directories": {
      "output": "dist-electron"
    },
    "mac": {
      "icon": "static/icon.icns",
      "category": "public.app-category.utilities"
    },
    "win": {
      "icon": "static/icon.ico",
      "target": ["nsis", "portable"]
    },
    "linux": {
      "icon": "static/icon.png",
      "category": "Utility",
      "target": ["AppImage", "deb", "rpm"]
    }
  }
}
```

---

## 📈 Version History

Check releases:

```bash
# List all releases
gh release list

# View specific version
gh release view v1.10.0

# Compare versions
git log v1.9.0...v1.10.0 --oneline
```

---

## 🤝 Contributing

When contributing, ensure commits follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Examples**:
- `feat: add bookmark export feature`
- `fix: resolve search crash with special characters`
- `docs: update installation instructions`
- `chore: upgrade dependencies`

This ensures proper versioning and changelog generation.

---

## 📚 Additional Resources

- [Semantic Versioning](https://semver.org/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Semantic Release](https://semantic-release.gitbook.io/)
- [Electron Builder](https://www.electron.build/)
- [GitHub Actions](https://docs.github.com/en/actions)

---

**Last Updated**: 2025-12-11
