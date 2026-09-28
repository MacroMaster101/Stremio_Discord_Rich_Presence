# 📦 Releasing a New Version

This guide explains how to publish a new version as a GitHub Release so users can
download it **and** receive automatic in-app updates.

> The app uses [`electron-updater`](https://www.electron.build/auto-update) wired to
> **GitHub Releases** (see [`src/updater.js`](src/updater.js) and the `publish` block in
> [`package.json`](package.json)). For auto-update to work, every release **must** include
> the `.exe` **plus** the auto-generated `latest.yml` and `.blockmap` files.

> ✨ Release files are intentionally hyphenated, like
> `Stremio-Discord-Presence-Setup-1.0.13.exe`, so GitHub assets and `latest.yml` match.

Releases are **built and published by GitHub Actions** ([`.github/workflows/release.yml`](.github/workflows/release.yml))
when a version tag is pushed. You don't need to build or upload anything by hand.

---

## ✅ Prerequisites (one-time)

- [Node.js](https://nodejs.org/) v18+ installed.
- Dependencies installed: `npm install`.
- GitHub CLI installed and logged in (`winget install --id GitHub.cli`, then `gh auth login`).

> 🔒 `main` is protected by a ruleset: changes land **only through pull requests** with
> passing CI (**Dependency audit**, **Build (Windows)**, and CodeQL). Direct pushes and
> force-pushes to `main` are blocked. Release tags (`v*`) can't be moved or deleted once pushed.

---

## 1️⃣ Bump the version in a pull request

`electron-updater` decides whether an update is available by comparing the app version
against the latest GitHub Release. **Bump it before every release.**

```powershell
git checkout main
git pull
git checkout -b release-1.0.13
npm version patch --no-git-tag-version
git commit -am "Bump version to 1.0.13"
git push -u origin release-1.0.13
gh pr create --fill
```

Use [semantic versioning](https://semver.org/): `MAJOR.MINOR.PATCH`
(e.g. `1.0.12` → `1.0.13` for a bug fix, `1.1.0` for a feature).

Wait for CI to pass, then **merge the PR**. CI also uploads the built installer as a
workflow artifact, if you want to test it before releasing.

---

## 2️⃣ Tag the release on `main`

```powershell
git checkout main
git pull
git tag v1.0.13
git push origin v1.0.13
```

The tag (`v1.0.13`) **must** match the `version` in `package.json` (`1.0.13`) and point to a
commit on `main`. The workflow refuses to publish otherwise.

---

## 3️⃣ Let the Release workflow publish it

Pushing the tag starts the **Release** workflow, which:

1. Verifies the tag matches `package.json` and is on `main`.
2. Runs `npm ci` and `npm audit` (fails on high/critical advisories in shipped dependencies).
3. Builds the NSIS installer with `npm run dist -- --publish never`.
4. Records a [build provenance attestation](https://docs.github.com/actions/security-for-github-actions/using-artifact-attestations) for the `.exe`.
5. Creates the GitHub Release with the `.exe`, `.blockmap` and `latest.yml`, and auto-generated notes.

Watch it under **Actions → Release**, or:

```powershell
gh run watch
```

Anyone can verify a downloaded installer was built by this workflow:

```powershell
gh attestation verify Stremio-Discord-Presence-Setup-1.0.13.exe --repo MacroMaster101/Stremio_Discord_Rich_Presence
```

---

## 4️⃣ Verify auto-update works

1. Install an **older packaged** version of the app.
2. Make sure the new release is published on GitHub and includes all three assets.
3. Launch the old app → open the tray menu → **Check for Updates**.
4. The tray should move through **Checking** → **Downloading** → **Restarting to update**.
5. The app should restart automatically and open on the new version.

> Auto-update only runs in the **packaged** app. It is a no-op when running via `npm start`
> in development (see [`src/updater.js`](src/updater.js)).

---

## 🧾 Quick checklist

- [ ] Version bumped in `package.json` and `package-lock.json` via a merged PR
- [ ] CI green on `main`
- [ ] Tag `vX.Y.Z` pushed from `main`, matching the app version
- [ ] Release workflow succeeded
- [ ] Release includes **`.exe` + `.blockmap` + `latest.yml`**
- [ ] Verified **Check for Updates** downloads and restarts into the new version

---

## 🛠️ Manual fallback

Only if GitHub Actions is unavailable. Build locally and upload the three files yourself.

> Building the NSIS installer locally needs **Developer Mode ON** (Settings → Privacy &
> security → For developers) *or* a terminal run **as Administrator**, because it can create
> symbolic links.

```powershell
npm run dist
gh release create v1.0.13 `
  "dist\Stremio-Discord-Presence-Setup-1.0.13.exe" `
  "dist\Stremio-Discord-Presence-Setup-1.0.13.exe.blockmap" `
  "dist\latest.yml" `
  --repo MacroMaster101/Stremio_Discord_Rich_Presence `
  --verify-tag `
  --title "v1.0.13" `
  --notes "Describe what changed in this release."
```

---

## 🛠️ Troubleshooting

| Problem | Fix |
| ------- | --- |
| Release workflow fails at "Verify tag" | The tag doesn't match `package.json`, or it wasn't created on `main`. Bump via PR, merge, then tag the merged commit. |
| Release workflow fails at `npm audit` | A shipped dependency has a high/critical advisory. Merge the Dependabot fix (or run `npm audit fix` in a PR), then tag again with a new version. |
| Can't push to `main` | Expected — `main` is protected. Open a pull request instead. |
| Auto-update never finds the new version | Confirm the release is published (not a draft), the tag is newer, and `latest.yml` was uploaded. |
| Update downloads but does not install | Confirm the `.exe` filename in `latest.yml` exactly matches the uploaded asset. |
| Tray stays on checking | Wait for the timeout, then retry. Also check GitHub/network access and that all three assets exist. |
| Users are still on an old version | They must launch the packaged app and pick **Check for Updates**, or relaunch so the startup check runs. |
