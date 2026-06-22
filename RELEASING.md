# 📦 Releasing a New Version

This guide explains how to build the Windows installer `.exe` and publish it as a
GitHub Release so users can download it **and** receive automatic in-app updates.

> The app uses [`electron-updater`](https://www.electron.build/auto-update) wired to
> **GitHub Releases** (see [`src/updater.js`](src/updater.js) and the `publish` block in
> [`package.json`](package.json)). For auto-update to work, every release **must** include
> the `.exe` **plus** the auto-generated `latest.yml` and `.blockmap` files.

> ✨ Release files are intentionally hyphenated, like
> `Stremio-Discord-Presence-Setup-1.0.8.exe`, so GitHub assets and `latest.yml` match.

---

## ✅ Prerequisites (one-time)

- [Node.js](https://nodejs.org/) v18+ installed.
- Dependencies installed: `npm install`.
- GitHub CLI installed: `winget install --id GitHub.cli`.
- Logged in to GitHub CLI: `gh auth login`.
- A clean working tree before you start the release.
- **Developer Mode ON** (Settings → Privacy & security → For developers) *or* run your
  terminal **as Administrator** — the NSIS installer build can create symbolic links.

> 💡 If PowerShell says `gh` is not recognized after installing GitHub CLI, restart VS Code
> or PowerShell. You can also run it directly with
> `& "C:\Program Files\GitHub CLI\gh.exe"`.

---

## 1️⃣ Bump the version

`electron-updater` decides whether an update is available by comparing the app version
against the latest GitHub Release. **Bump it before every release.**

For a patch release:

```powershell
npm version patch --no-git-tag-version
```

Or set an exact version:

```powershell
npm version 1.0.8 --no-git-tag-version
```

This updates both [`package.json`](package.json) and [`package-lock.json`](package-lock.json).
Use [semantic versioning](https://semver.org/): `MAJOR.MINOR.PATCH`
(e.g. `1.0.7` → `1.0.8` for a bug fix, `1.1.0` for a feature).

---

## 2️⃣ Build the installer

```powershell
npm run dist
```

This produces the release assets in `dist/`:

| File | Purpose |
| ---- | ------- |
| `Stremio-Discord-Presence-Setup-1.0.8.exe` | The installer users download |
| `Stremio-Discord-Presence-Setup-1.0.8.exe.blockmap` | Enables fast differential updates |
| `latest.yml` | **Required** — tells the app what's newest |

> ⚠️ Upload all three files. If `latest.yml` is missing or points to a different filename,
> auto-update breaks.

> 🧹 `electron-builder` may also create `dist/win-unpacked/`. That's useful for local testing,
> but it is **not** uploaded to GitHub Releases.

---

## 3️⃣ Commit and push

Commit the version bump and code/doc changes before creating the release.

```powershell
git status
git add .
git commit -m "Release v1.0.8"
git push
```

> The GitHub Release tag (`v1.0.8`) should match the app version (`1.0.8`).

---

## 4️⃣ Create the GitHub Release

### Using GitHub CLI *(recommended)*

```powershell
gh release create v1.0.8 `
  "dist\Stremio-Discord-Presence-Setup-1.0.8.exe" `
  "dist\Stremio-Discord-Presence-Setup-1.0.8.exe.blockmap" `
  "dist\latest.yml" `
  --repo MacroMaster101/Stremio_Discord_Rich_Presence `
  --target main `
  --title "v1.0.8" `
  --notes "Describe what changed in this release."
```

If `gh` is installed but not in PATH, use the full path:

```powershell
& "C:\Program Files\GitHub CLI\gh.exe" release create v1.0.8 `
  "dist\Stremio-Discord-Presence-Setup-1.0.8.exe" `
  "dist\Stremio-Discord-Presence-Setup-1.0.8.exe.blockmap" `
  "dist\latest.yml" `
  --repo MacroMaster101/Stremio_Discord_Rich_Presence `
  --target main `
  --title "v1.0.8" `
  --notes "Describe what changed in this release."
```

If the release already exists and you only need to replace assets:

```powershell
gh release upload v1.0.8 `
  "dist\Stremio-Discord-Presence-Setup-1.0.8.exe" `
  "dist\Stremio-Discord-Presence-Setup-1.0.8.exe.blockmap" `
  "dist\latest.yml" `
  --repo MacroMaster101/Stremio_Discord_Rich_Presence `
  --clobber
```

### Using the web UI

1. Go to **[Releases](https://github.com/MacroMaster101/Stremio_Discord_Rich_Presence/releases) → Draft a new release**.
2. **Choose a tag:** `v1.0.8`.
3. **Release title:** `v1.0.8`.
4. Write release notes.
5. Drag in all three files from `dist/`:
   - `Stremio-Discord-Presence-Setup-1.0.8.exe`
   - `Stremio-Discord-Presence-Setup-1.0.8.exe.blockmap`
   - `latest.yml`
6. Click **Publish release**.

---

## 5️⃣ Verify auto-update works

1. Install an **older packaged** version of the app.
2. Make sure the new release is published on GitHub and includes all three assets.
3. Launch the old app → open the tray menu → **Check for Updates**.
4. The tray should move through **Checking** → **Downloading** → **Restarting to update**.
5. The app should restart automatically and open on the new version.

> Auto-update only runs in the **packaged** app. It is a no-op when running via `npm start`
> in development (see [`src/updater.js`](src/updater.js)).

---

## 🧾 Quick checklist

- [ ] Bumped `version` in `package.json` and `package-lock.json`
- [ ] Ran `npm run dist`
- [ ] Confirmed `dist/latest.yml` points to the new `.exe`
- [ ] Release includes **`.exe` + `.blockmap` + `latest.yml`**
- [ ] GitHub Release tag matches the app version (`v1.0.8` ↔ `1.0.8`)
- [ ] Release is published, not left as a draft
- [ ] Verified **Check for Updates** downloads and restarts into the new version

---

## 🛠️ Troubleshooting

| Problem | Fix |
| ------- | --- |
| Build fails with a symlink / privilege error | Enable **Developer Mode** or run the terminal **as Administrator**. |
| `gh` is installed but not recognized | Restart VS Code/PowerShell, or use `& "C:\Program Files\GitHub CLI\gh.exe"`. |
| Auto-update never finds the new version | Confirm the release is published, the tag is newer, and `latest.yml` was uploaded. |
| Update downloads but does not install | Confirm the `.exe` filename in `latest.yml` exactly matches the uploaded asset. |
| Tray stays on checking | Wait for the timeout, then retry. Also check GitHub/network access and that all three assets exist. |
| Users are still on an old version | They must launch the packaged app and pick **Check for Updates**, or relaunch so the startup check runs. |
