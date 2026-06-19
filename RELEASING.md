# 📦 Releasing a New Version

This guide explains how to build the Windows installer `.exe` and publish it as a
GitHub Release so users can download it **and** receive automatic in-app updates.

> The app uses [`electron-updater`](https://www.electron.build/auto-update) wired to
> **GitHub Releases** (see [`src/updater.js`](src/updater.js) and the `publish` block in
> [`package.json`](package.json)). For auto-update to work, every release **must** include
> the `.exe` **plus** the auto-generated `latest.yml` and `.blockmap` files.

---

## ✅ Prerequisites (one-time)

- [Node.js](https://nodejs.org/) v18+ installed.
- Dependencies installed: `npm install`.
- A clean working tree (commit your changes first).
- **Developer Mode ON** (Settings → Privacy & security → For developers) *or* run your
  terminal **as Administrator** — the NSIS installer build creates symbolic links.

---

## 1️⃣ Bump the version

`electron-updater` decides whether an update is available by comparing the `version` in
`package.json` against the latest GitHub Release. **Bump it before every release.**

Edit [`package.json`](package.json):

```jsonc
{
  "version": "1.0.1"   // was 1.0.0
}
```

Use [semantic versioning](https://semver.org/): `MAJOR.MINOR.PATCH`
(e.g. `1.0.0` → `1.0.1` for a bug fix, `1.1.0` for a feature).

---

## 2️⃣ Build the installer

There are two ways to publish. **Pick one.**

### Option A — Let electron-builder publish automatically *(recommended)*

This builds the installer **and** uploads everything (`.exe`, `latest.yml`, `.blockmap`)
to a GitHub Release in one command — no manual file juggling, and auto-update "just works".

1. Create a **GitHub Personal Access Token** with `repo` scope:
   [github.com/settings/tokens](https://github.com/settings/tokens) → *Generate new token (classic)* → check **repo**.

2. Set it as an environment variable, then publish:

   **PowerShell**
   ```powershell
   $env:GH_TOKEN = "ghp_your_token_here"
   npx electron-builder --win --publish always
   ```

   **Git Bash**
   ```bash
   export GH_TOKEN="ghp_your_token_here"
   npx electron-builder --win --publish always
   ```

3. electron-builder creates a **draft release** tagged `v1.0.1` on GitHub with all assets
   attached. Go to the repo's **Releases** page, add release notes, and click **Publish release**.

> ✨ With this option you can skip steps 3 and 4 below.

### Option B — Build locally, upload manually

```bash
npm run dist
```

This produces these files in the `dist/` folder:

| File                                          | Purpose                                  |
| --------------------------------------------- | ---------------------------------------- |
| `Stremio Discord Presence Setup 1.0.1.exe`    | The installer users download             |
| `Stremio Discord Presence Setup 1.0.1.exe.blockmap` | Enables fast differential updates  |
| `latest.yml`                                  | **Required** — tells the app what's newest |

> ⚠️ All three files must be uploaded to the release. If `latest.yml` is missing, auto-update breaks.

> 💡 You currently have a build at `D:\My Projects\Stremio Discord Presence Setup 1.0.0.exe`.
> For a proper release, rebuild with `npm run dist` so the matching `latest.yml` and
> `.blockmap` land in `dist/` next to the `.exe` — those two extra files are what the
> auto-updater relies on.

---

## 3️⃣ Tag the release in git *(Option B only)*

```bash
git add package.json
git commit -m "Release v1.0.1"
git tag v1.0.1
git push origin main --tags
```

> The git tag (`v1.0.1`) must match the release tag on GitHub. electron-updater matches
> by the version string.

---

## 4️⃣ Create the GitHub Release *(Option B only)*

### Using the web UI

1. Go to **[Releases](https://github.com/MacroMaster101/Stremio_Discord_Rich_Presence/releases) → Draft a new release**.
2. **Choose a tag:** `v1.0.1` (the one you just pushed).
3. **Release title:** `v1.0.1`.
4. Write release notes (what changed).
5. **Drag in all three files** from `dist/`:
   - `Stremio Discord Presence Setup 1.0.1.exe`
   - `Stremio Discord Presence Setup 1.0.1.exe.blockmap`
   - `latest.yml`
6. Click **Publish release**.

### Or using the GitHub CLI ([`gh`](https://cli.github.com/))

```bash
gh release create v1.0.1 \
  "dist/Stremio Discord Presence Setup 1.0.1.exe" \
  "dist/Stremio Discord Presence Setup 1.0.1.exe.blockmap" \
  "dist/latest.yml" \
  --title "v1.0.1" \
  --notes "Describe what changed in this release."
```

---

## 5️⃣ Verify auto-update works

1. Install an **older** version of the app (e.g. the existing `1.0.0` build at `D:\My Projects`).
2. Make sure your **new** release (`v1.0.1`) is published on GitHub.
3. Launch the old app → open the tray menu → **Check for Updates**.
4. It should detect `1.0.1`, download it in the background, and install on next quit.

> Auto-update only runs in the **packaged** app — it's a no-op when running via `npm start`
> in development (see the note in [`src/updater.js`](src/updater.js)).

---

## 🧾 Quick checklist

- [ ] Bumped `version` in `package.json`
- [ ] Built with `npm run dist` (or published via `--publish always`)
- [ ] Release includes **`.exe` + `.blockmap` + `latest.yml`**
- [ ] Git tag matches the release tag (`v1.0.1`)
- [ ] Release published (not left as a draft)
- [ ] Verified **Check for Updates** finds the new version

---

## 🛠️ Troubleshooting

| Problem | Fix |
| ------- | --- |
| Build fails with a symlink / privilege error | Enable **Developer Mode** or run the terminal **as Administrator**. |
| Auto-update never finds the new version | Confirm `latest.yml` was uploaded and the `version` in it matches the release tag. |
| `--publish always` fails to upload | Check `GH_TOKEN` is set and has `repo` scope; confirm `publish.owner`/`publish.repo` in `package.json` point to `MacroMaster101/Stremio_Discord_Rich_Presence`. |
| Users on old versions don't get prompted | They must open the tray menu and pick **Check for Updates**, or relaunch — the check runs on launch. |
