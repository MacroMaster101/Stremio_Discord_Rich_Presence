<div align="center">

<img src="assets/app-icon.png" alt="Stremio Discord Presence" width="128" height="128" />

# Stremio Discord Presence

### Show off what you're watching on **Stremio** — right on your **Discord** profile. 🍿

A lightweight Windows companion that lives quietly in your system tray, detects when **Stremio Desktop** is running, and automatically updates your **Discord Rich Presence** — complete with real poster art.

<br/>

[![Download](https://img.shields.io/github/v/release/MacroMaster101/Stremio_Discord_Rich_Presence?style=for-the-badge&label=Download&logo=windows&color=5865F2)](https://github.com/MacroMaster101/Stremio_Discord_Rich_Presence/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/MacroMaster101/Stremio_Discord_Rich_Presence/ci.yml?branch=main&style=for-the-badge&label=CI)](https://github.com/MacroMaster101/Stremio_Discord_Rich_Presence/actions/workflows/ci.yml)

![Platform](https://img.shields.io/badge/platform-Windows-0078D6?style=flat-square&logo=windows&logoColor=white)
![Electron](https://img.shields.io/badge/Electron-47848F?style=flat-square&logo=electron&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-22.12%2B-339933?style=flat-square&logo=node.js&logoColor=white)
![No setup required](https://img.shields.io/badge/setup-zero%20config-brightgreen?style=flat-square)
![Privacy](https://img.shields.io/badge/privacy-first-blueviolet?style=flat-square)

</div>

---

## ✨ Why you'll like it

> **Zero config.** Install, run, done. It ships with a built-in Discord application, so most people never touch a single setting.

<table>
<tr>
<td width="50%" valign="top">

🟢 **Works out of the box**
No tokens, no `.env`, no Discord account setup. Just install and run.

📺 **Smart title parsing**
Shows the series name with `SxxExx` + episode title, anime absolute episodes as `E60`, or the movie name and year — parsed straight from the active stream, with release-group and tracker tags stripped.

🖼️ **Real poster art**
Pulls genuine posters from Stremio's own Cinemeta addon (no API key) with a little Stremio badge overlay.

🔘 **Presence buttons**
"Get Stremio" and "Search Title" buttons right on your Rich Presence card.

</td>
<td width="50%" valign="top">

🫥 **Privacy Mode**
One click swaps to a generic *"Watching Stremio"* — hides what you're actually watching *and* disables poster lookups.

🟣 **Browsing vs watching**
Shows *"Browsing Stremio"* when you're picking something, and switches to the title the moment you start streaming.

🎨 **Theme-aware tray icon**
A status dot (🟢 connected · 🟡 connecting · 🔴 disconnected) with an outline that adapts to your light or dark Windows taskbar.

🚀 **Start with Windows**
Optional toggle to launch minimized at login — and it shows up in Task Manager's Startup tab.

🔄 **Auto-updates**
Checks GitHub for new versions, shows tray progress, downloads in the background, and silently installs and restarts when ready.

🔁 **Bulletproof reconnect**
Handles Discord not running at startup, or being closed and reopened — it just reconnects.

</td>
</tr>
</table>

---

## 📥 Installation

### Option A — Installer *(recommended for most users)*

1. Download **`Stremio-Discord-Presence-Setup-x.x.x.exe`** from the **[latest release](https://github.com/MacroMaster101/Stremio_Discord_Rich_Presence/releases/latest)**.
2. Run it — it's a **one-click installer**: no wizard, no admin prompt. It installs for your Windows user and adds **Desktop** and **Start Menu** shortcuts.
3. The app launches into your system tray and connects to Discord automatically. Future versions install themselves via auto-update.

> 🛡️ **First launch:** Windows SmartScreen may warn about an "unknown publisher" because the app isn't signed with a paid certificate. Click **More info → Run anyway** — it's expected for indie apps.
>
> Want proof the installer is genuine? Every release is built by GitHub Actions from this repo's source with a signed [build provenance attestation](https://docs.github.com/actions/security-for-github-actions/using-artifact-attestations). With the [GitHub CLI](https://cli.github.com/) you can verify it:
>
> ```bash
> gh attestation verify Stremio-Discord-Presence-Setup-x.x.x.exe --repo MacroMaster101/Stremio_Discord_Rich_Presence
> ```

> 💡 That's it. No Node.js, no `.env`, no Discord account setup — the app ships with a built-in Discord application ID.

### Option B — Run from source *(for developers)*

```bash
# 1. Install Node.js v22.12+ (LTS recommended)  →  https://nodejs.org/
# 2. Install dependencies
npm install

# 3. Start the app
npm start
```

---

## 🕹️ Using the App

Look for the Stremio Discord Presence icon in your Windows system tray (near the clock). **Click it** to open the menu, where you can:

- 👀 View live connection statuses (Discord & Stremio — including the current title or *Browsing*)
- 🫥 Toggle **Privacy Mode** to hide what you're watching
- 🚀 Toggle **Start with Windows** (launches minimized at login)
- 🖼️ Toggle **Show Poster Art**
- 🔁 **Reconnect Discord** manually
- 🔄 **Check for Updates** — shows checking/download/retry status in the tray and auto-restarts when ready
- ℹ️ Open **About** for version info and links
- ❌ **Quit** the application

---

## ⚙️ Configuration

The Discord Client ID is **built into the app** — there's nothing to configure for normal use.

For development or advanced use (running from source), a couple of optional settings can go in a `.env` file in the project root (copy `.env.example`):

| Variable           | Description                                          | Default |
| ------------------ | ---------------------------------------------------- | ------- |
| `POLL_INTERVAL_MS` | How often (ms) to check whether Stremio is running.  | `5000`  |
| `PRIVACY_MODE`     | Start with Privacy Mode on (`true`/`false`).         | `false` |

<details>
<summary><b>🎨 Using your own Discord application (advanced)</b></summary>

<br/>

The app uses a bundled Discord application by default. If you want your own branding on Discord instead, change the built-in Client ID in the source:

1. Open the [Discord Developer Portal](https://discord.com/developers/applications) → **New Application**.
2. Copy the **Application ID** from **General Information**.
3. Go to **Rich Presence → Art Assets**, upload a Stremio image, and name the asset key exactly `stremio` (lowercase) so the large image shows correctly.
4. Set the new ID as `CLIENT_ID` in [`src/config.js`](src/config.js) and rebuild.

</details>

---

## 🔒 Privacy & Security

This app is **privacy-respecting by default**:

- **No login, ever.** It never asks for — or has access to — your Discord or Stremio account, password, or tokens. It talks to your **already-running** Discord desktop client over local Rich Presence (IPC), exactly like Spotify or a game does.
- **Local by default.** Core functionality only talks to your **local** Discord client and your **local** Stremio server (`127.0.0.1:11470`). Nothing goes to any third-party backend — *except* the optional poster feature below.
- **Optional poster art (Cinemeta).** When **Show Poster Art** is on (a tray toggle, on by default), the app sends only the current media's **title** to Stremio's own public **Cinemeta** metadata addon to fetch a poster. No API key, no account info, no identifiers. Turn it off (or enable Privacy Mode) for zero external calls.
- **No telemetry or analytics.** No usage data, crash reports, or identifiers are collected or transmitted.
- **No account data accessed.** Your Stremio library, watch history, and sync data are never read.
- **Nothing stored.** The app doesn't write your activity to disk or keep logs of what you watch.
- **Privacy Mode.** The title you broadcast comes from the streaming file name, so it can occasionally include release tags. Toggle **Privacy Mode** to broadcast only a generic *"Watching Stremio"* with no details (this also disables poster lookups).

> What Discord shows about you still follows **your own Discord privacy settings** (who can see your activity). This app only adds the Rich Presence activity described above.

<details>
<summary><b>🛡️ Security notes for contributors</b></summary>

<br/>

- Found a vulnerability? Please report it privately — see **[SECURITY.md](SECURITY.md)**.
- Minimal dependencies (`discord-rpc`, `dotenv`, `electron-updater`); CI fails on high/critical `npm audit` advisories, Dependabot keeps dependencies current, and CodeQL scans every pull request.
- Release installers are built by GitHub Actions with a [build provenance attestation](RELEASING.md#3️⃣-let-the-release-workflow-publish-it).
- The process check runs a fixed system command with **no user input**, so there's no command-injection surface.
- App windows follow Electron's security guidelines: `contextIsolation` on, `nodeIntegration` off, `sandbox` on, with a minimal `contextBridge` preload. External links open through a main-process allow-list.

</details>

---

## 🗂️ Project Structure

```text
stremio-discord-presence/
├── package.json            # Node dependencies, build config & scripts
├── README.md               # Documentation & setup instructions
├── RELEASING.md            # How to build & publish a release
├── SECURITY.md             # How to report a vulnerability
├── .env.example            # Environment variables template
├── .github/
│   ├── dependabot.yml      # Weekly npm + GitHub Actions update PRs
│   └── workflows/
│       ├── ci.yml          # Audit + Windows build on every PR / push to main
│       └── release.yml     # Builds & publishes a release when a v* tag is pushed
├── build/
│   └── installer.nsh       # Custom NSIS: removes startup entries on uninstall
├── assets/
│   ├── app-icon.ico        # Windows executable / installer icon
│   ├── app-icon.png        # App window & About icon
│   └── tray-icon.png       # System tray icon (status dot composited at runtime)
└── src/
    ├── main.js             # Electron main process controller
    ├── config.js           # App configuration (built-in Client ID, .env options)
    ├── stremioDetector.js  # Stremio detection + active-title parsing
    ├── cinemeta.js         # Poster lookups via Stremio's Cinemeta addon
    ├── discordRpc.js       # Discord Rich Presence connection manager
    ├── updater.js          # Auto-update via electron-updater + GitHub Releases
    ├── tray.js             # System tray menu and status rendering
    ├── trayIcon.js         # Builds theme-aware, status-colored tray icons
    ├── aboutWindow.js      # Controller for the About window
    ├── aboutPreload.js     # Secure contextBridge preload for the About window
    └── about.html          # UI for the About window
```

> **Why an HTML file?** Electron renders its windows with HTML/CSS (it's Chromium under the hood). `about.html` is the actual UI for the About window — loaded by `aboutWindow.js` through the sandboxed `aboutPreload.js` bridge.

---

## 🧰 Troubleshooting

<details>
<summary><b>"Discord: Disconnected" or a reconnection loop</b></summary>

<br/>

- Ensure the **Discord desktop client** is running and you're logged in. The Discord **web** app does **not** support Local RPC.
- If you opened Discord *after* starting this app, it reconnects automatically every 15 seconds — or click **Reconnect Discord** in the tray to connect immediately.

</details>

<details>
<summary><b>Start with Windows looks wrong in Task Manager</b></summary>

<br/>

- Toggle **Start with Windows** from the tray menu once. The app keeps the Windows `Run` entry and Task Manager's Startup state in sync, so disabled should show as **Disabled** instead of leaving a broken leftover entry.
- Close and reopen Task Manager if it still shows the old state — Windows can cache the Startup apps list.
- If you installed an older build before the startup cleanup fixes, install the latest release once so the installer/uninstaller can clean old startup names.

</details>

<details>
<summary><b>"Check for Updates" stays on checking</b></summary>

<br/>

- Auto-update only works in the packaged installer build, not while running from source with `npm start`.
- Make sure the GitHub Release is published and includes all three files: `.exe`, `.exe.blockmap`, and `latest.yml`.
- If GitHub or the network does not respond, the tray changes to **Update failed - Try again** after a timeout instead of staying stuck.
- When an update is found, the app downloads it, shows progress in the tray, then restarts automatically to install it.

</details>
<details>
<summary><b>Stremio status not updating</b></summary>

<br/>

- Ensure Stremio Desktop is running. The app looks for the `stremio-shell-ng.exe` or `stremio.exe` process on Windows.
- Make sure Stremio is fully launched, not just sitting idle in the background.
- Poster art and titles come from Stremio's local server on `127.0.0.1:11470`; if a title doesn't appear, give it a few seconds to start streaming.

</details>

---

## 🔨 Building From Source

The app is packaged with [electron-builder](https://www.electron.build/), already configured in `package.json`.

```bash
# Build a portable folder (dist/win-unpacked/) containing the .exe
npm run pack

# Build a Windows installer (dist/Stremio-Discord-Presence-Setup-x.x.x.exe)
npm run dist
```

> **Note:** Building the NSIS installer (`npm run dist`) may require **Developer Mode** enabled (Settings → Privacy & security → For developers) or an elevated terminal, because it creates symbolic links. The portable build (`npm run pack`) has no such requirement.

Every pull request and every push to `dev` or `main` runs **[CI](.github/workflows/ci.yml)**: a dependency audit plus a full Windows installer build (downloadable from the workflow run's artifacts).

📖 **Publishing a release?** Releases are built and published automatically by GitHub Actions when a version tag is pushed — see **[RELEASING.md](RELEASING.md)**.

---

## 🤝 Contributing

Pull requests are welcome!

1. Fork the repo and create a branch from **`dev`**.
2. Make your change and check it runs with `npm start`.
3. Open a pull request **into `dev`**. CI (**Dependency audit** + **Build (Windows)**) runs on every PR.

`dev` is the integration branch; it's merged into `main` through a pull request. `main` is protected, so that PR can only merge once **Dependency audit**, **Build (Windows)** and **CodeQL** all pass.

Dependabot opens weekly PRs against `dev` to keep npm packages and GitHub Actions up to date.

🔒 **Found a security issue?** Please don't open a public issue — report it privately as described in **[SECURITY.md](SECURITY.md)**.

---

## 🗺️ Roadmap

**Planned**

- ⏯️ **Playback Detection** — detect play/pause states. *(Currently limited: Stremio's local API doesn't expose playback position, duration, or play/pause state, so a true progress bar isn't possible yet.)*

**Recently shipped ✅**

- 🔐 **Security & release pipeline** — CodeQL scanning, Dependabot, private vulnerability reporting, a protected `main` branch, and CI-built releases with build provenance attestations.
- 🎌 **Anime episode detection** — absolute episode numbers shown as `E60` (not `S01E60`), with fansub group, CRC and tracker tags stripped.
- ⚡ **One-click installer** — no wizard; makes silent auto-updates install reliably.
- 🟣 **Browsing state** — shows *"Browsing Stremio"* when idle, switching to the title on playback.
- 🔄 **Auto-updates** — tray progress, background download, and automatic restart/install when ready.
- 🎨 **Redesigned About window** and a **theme-aware tray icon** that adapts to light/dark taskbars.
- 📺 **Rich title parsing** — series name with `SxxExx` + episode title, or movie name and year.
- 🖼️ **Poster artwork** — real posters from Stremio's Cinemeta addon (no API key) with a Stremio badge overlay.
- 🔘 **Presence buttons** — "Get Stremio" and "Search Title" on the Rich Presence card.
- 🚀 **Launch on Startup** — run minimized at Windows login, with Task Manager startup state kept in sync.
- 🧹 **Uninstall cleanup** — removes Windows Startup leftovers when the app is uninstalled.
- 🟢 **Built-in Discord application** — works with zero setup.

---

<div align="center">

### License

**MIT** © [Kavisha Lakshan](https://github.com/MacroMaster101)

<sub>Made with 🍿 for the Stremio + Discord community.</sub>

</div>
