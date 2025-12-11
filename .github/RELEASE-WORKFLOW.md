# Release Workflow Documentation

## Overview

This project uses an automated release workflow with semantic versioning. The workflow ensures that releases are **only published with all assets successfully built**, preventing partial or incomplete releases.

## Workflow Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Developer pushes commit to main                          │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Semantic Release analyzes commit messages                │
│    - feat: → Minor version (1.0.0 → 1.1.0)                  │
│    - fix: → Patch version (1.0.0 → 1.0.1)                   │
│    - BREAKING CHANGE: → Major version (1.0.0 → 2.0.0)       │
│    - chore/docs/etc: → No release                           │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Creates DRAFT release (invisible to users)               │
│    - Updates CHANGELOG.md                                   │
│    - Commits version bump                                   │
│    - Creates git tag                                        │
│    - Triggers build workflow via workflow_dispatch         │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Build Workflow starts                                    │
│                                                              │
│  ┌──────────────────────────────────────────────┐           │
│  │ Prebuild Job (runs once)                     │           │
│  │ - Builds SvelteKit app                       │           │
│  │ - Uploads as artifact                        │           │
│  └──────────┬───────────────────────────────────┘           │
│             │                                                │
│             ▼                                                │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Matrix Build Jobs (parallel)                        │    │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐      │    │
│  │  │ macOS      │ │ Windows    │ │ Linux      │      │    │
│  │  │ - x64      │ │ - x64      │ │ - x64      │      │    │
│  │  │ - arm64    │ │ - arm64    │ │ - arm64    │      │    │
│  │  │ → DMG, ZIP │ │ → EXE, ZIP │ │ → DEB, RPM │      │    │
│  │  └─────┬──────┘ └─────┬──────┘ └─────┬──────┘      │    │
│  └────────┼──────────────┼──────────────┼─────────────┘    │
│           │              │              │                   │
│           └──────────────┴──────────────┘                   │
│                          │                                  │
└──────────────────────────┼──────────────────────────────────┘
                           │
                   ┌───────┴────────┐
                   │                │
                   ▼                ▼
        ┌──────────────────┐  ┌──────────────────┐
        │ All Succeeded?   │  │ Any Failed?      │
        │                  │  │                  │
        │ publish-release  │  │ cleanup-failed   │
        │ (if: success())  │  │ (if: failure())  │
        │                  │  │                  │
        │ Makes draft      │  │ Deletes draft    │
        │ PUBLIC ✅        │  │ release 🗑️      │
        └──────────────────┘  └──────────────────┘
```

## Workflow States

### Success Path ✅
1. Draft created → **Invisible to users**
2. All builds succeed → Assets uploaded to draft
3. `publish-release` job runs → **Draft becomes public**
4. Users see complete release with all assets

### Failure Path ❌
1. Draft created → **Invisible to users**  
2. Any build fails → Some assets may be uploaded
3. `cleanup-failed-release` job runs → **Draft deleted**
4. Users **never see** the incomplete release

## Commit Message Format

Follow [Conventional Commits](https://www.conventionalcommits.org/):

### Release Types
- `feat: add new feature` → **Minor release** (1.0.0 → 1.1.0)
- `fix: resolve bug` → **Patch release** (1.0.0 → 1.0.1)
- `perf: improve performance` → **Patch release**
- `refactor: restructure code` → **Patch release**

### No Release
- `chore: update dependencies` → No release
- `docs: update README` → No release
- `style: format code` → No release
- `test: add tests` → No release
- `ci: update workflows` → No release

### Breaking Changes
```
feat: redesign API

BREAKING CHANGE: API endpoints renamed
```
→ **Major release** (1.0.0 → 2.0.0)

## Build Outputs

### macOS (4 binaries)
- `WhatsApp-Backup-Reader-{version}-arm64-mac.zip` (Apple Silicon)
- `WhatsApp-Backup-Reader-{version}-arm64.dmg` (Apple Silicon)
- `WhatsApp-Backup-Reader-{version}-x64-mac.zip` (Intel)
- `WhatsApp-Backup-Reader-{version}.dmg` (Intel)

### Windows (4 binaries)
- `WhatsApp-Backup-Reader-Setup-{version}-arm64.exe` (ARM64)
- `WhatsApp.Backup.Reader-{version}-arm64-win.zip` (ARM64 Portable)
- `WhatsApp-Backup-Reader-Setup-{version}.exe` (x64)
- `WhatsApp.Backup.Reader-{version}-win.zip` (x64 Portable)

### Linux (4 binaries)
- `whats-reader_{version}_amd64.deb` (Debian/Ubuntu x64)
- `whats-reader_{version}_arm64.deb` (Debian/Ubuntu ARM64)
- `whats-reader-{version}.x86_64.rpm` (Fedora/RHEL x64)
- `whats-reader-{version}.aarch64.rpm` (Fedora/RHEL ARM64)

### Auto-Updater Files
- `latest.yml` (Windows)
- `latest-mac.yml` (macOS)
- `latest-linux.yml` (Linux)

**Total: ~15 files per release**

## Reliability Features

### Retry Logic
```yaml
npm ci --prefer-offline || \
npm ci --prefer-offline || \
npm ci
```
- 3 attempts to install dependencies
- Uses offline cache first to reduce CDN failures

### Parallel Builds
```yaml
strategy:
  fail-fast: false
  matrix:
    include:
      - os: macos-latest
      - os: windows-latest
      - os: ubuntu-latest
```
- All platforms build simultaneously
- One failure doesn't stop others
- Faster overall build time (~15 minutes vs. 45+ minutes sequential)

### Artifact Caching
- Electron binaries cached between runs
- SvelteKit build shared across all platforms
- Reduces bandwidth and build time

### Draft Protection
- Release invisible until **all** assets ready
- No partial releases visible to users
- Failed builds automatically cleaned up

## Testing the Workflow

### Manual Test
1. Make a change: `echo "test" > test.txt`
2. Create commit: `git add test.txt && git commit -m "fix: test release"`
3. Push: `git push origin main`
4. Watch workflows:
   - **Release workflow**: Creates draft → `gh run list --workflow=release.yml`
   - **Build workflow**: Builds binaries → `gh run watch --workflow=build.yml`
5. Verify release: `gh release view <version>`

### Check Build Status
```bash
# List recent builds
gh run list --workflow=build.yml --limit 5

# Watch active build
gh run watch

# View specific run
gh run view <run-id>
```

### Check Releases
```bash
# List all releases
gh release list --limit 10

# View specific release
gh release view v1.13.4

# Check if draft exists
gh release list | grep Draft
```

## Monitoring

### Success Indicators
- ✅ Release workflow completes (creates draft + triggers build)
- ✅ Build workflow completes (all 3 platforms)
- ✅ Publish job runs (makes draft public)
- ✅ Release appears in `gh release list` (not draft)
- ✅ All ~15 assets present

### Failure Indicators
- ❌ Any matrix job fails
- ❌ Cleanup job runs (deletes draft)
- ❌ Draft release left behind (should never happen)

### Logs Location
- **GitHub Actions**: `https://github.com/rodrigogs/whats-reader/actions`
- **Release workflow**: `.github/workflows/release.yml`
- **Build workflow**: `.github/workflows/build.yml`

## Troubleshooting

### Problem: Build fails with npm install error
**Cause**: Transient CDN issues (503 errors)  
**Solution**: Retry logic handles this automatically (3 attempts)  
**Manual fix**: Re-run the workflow from GitHub Actions UI

### Problem: Platform-specific build fails
**Cause**: Platform-specific dependency or electron-builder issue  
**Solution**: Check the specific job logs in GitHub Actions  
**Check**: Look for platform in matrix (macOS/Windows/Linux)

### Problem: Draft release left behind
**Cause**: Cleanup job failed to run  
**Solution**: Manually delete with `gh release delete <tag> --yes`

### Problem: Release created but no assets
**Cause**: Build workflow didn't trigger or failed  
**Solution**: Check if commit message matches release rules  
**Check**: Only `feat:`, `fix:`, `perf:`, `refactor:` trigger releases

### Problem: Multiple releases triggered
**Cause**: Force push or rebase after release  
**Solution**: Let semantic-release handle versioning, don't force push to main

## Configuration Files

- `.releaserc.json`: Semantic release configuration
- `.github/workflows/release.yml`: Release workflow
- `.github/workflows/build.yml`: Build workflow
- `package.json`: Build targets and version

## Best Practices

1. **Never force push to main** - breaks release workflow
2. **Use conventional commits** - enables automated versioning
3. **Test locally first** - `npm run electron:build` before pushing
4. **Monitor build status** - use `gh run watch` or GitHub UI
5. **Don't create releases manually** - let the workflow handle it
6. **Check changelog** - `CHANGELOG.md` updated automatically
7. **Wait for completion** - builds take ~15 minutes

## Security

- All secrets managed via GitHub Secrets
- `GITHUB_TOKEN` auto-generated per workflow
- No external credentials stored in repository
- Draft releases prevent incomplete public releases

## Performance

- **Sequential** (old): 45+ minutes (prebuild → mac → win → linux)
- **Parallel** (current): ~15 minutes (prebuild + matrix)
- **Speedup**: 3x faster with better reliability

## Release History Example

```bash
$ gh release list
TITLE    TYPE    TAG NAME  PUBLISHED           
v1.13.4  Latest  v1.13.4   about 1 hour ago    # ✅ Full release
v1.13.3          v1.13.3   about 1 hour ago    # ❌ Failed, cleaned up
v1.13.2          v1.13.2   about 2 hours ago   # ❌ Failed, cleaned up
v1.13.1          v1.13.1   about 3 hours ago   # ✅ Full release
```

Notice: v1.13.2 and v1.13.3 show in history but were drafts that got deleted. Only v1.13.1 and v1.13.4 were published.

## Support

For issues with the release workflow:
1. Check GitHub Actions logs
2. Review this documentation
3. Check recent changes to workflow files
4. File an issue with logs attached
