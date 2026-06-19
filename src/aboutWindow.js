/**
 * src/aboutWindow.js
 * Small "About" window showing the app name, version, links, and credits.
 */

const path = require('path');
const { BrowserWindow, ipcMain, app, nativeImage, shell } = require('electron');

let aboutWindow = null;
let ipcRegistered = false;

// Only these external URLs may be opened from the About window.
const ALLOWED_LINKS = {
  github: 'https://github.com/MacroMaster101/Stremio_Discord_Rich_Presence',
  discordPortal: 'https://discord.com/developers/applications'
};

// Live status provider, supplied by main via registerIpc(). Lets the About
// window show the real Discord/Stremio state instead of static text.
let statusProvider = () => ({ discordStatus: 'Disconnected', stremioRunning: false });

// Read author/license from package.json once (best-effort).
let pkg = {};
try {
  pkg = require('../package.json');
} catch (e) {
  pkg = {};
}

/**
 * Open the About window, or focus it if already open.
 */
function openAboutWindow() {
  if (aboutWindow) {
    aboutWindow.focus();
    return;
  }

  aboutWindow = new BrowserWindow({
    // useContentSize makes width/height the *content* area (excludes the OS
    // title bar), so the card always fits with no scrollbar. The card renders
    // ~454px tall + 44px body padding ≈ 498px; 506 leaves a hair of margin.
    width: 432,
    height: 506,
    useContentSize: true,
    resizable: false,
    backgroundColor: '#0d0e12',
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    title: 'About — Stremio Discord Presence',
    icon: path.join(__dirname, '..', 'assets', 'app-icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      // Secure defaults: the renderer has no direct Node access. It talks to the
      // main process only through the minimal API exposed in aboutPreload.js.
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'aboutPreload.js')
    }
  });

  aboutWindow.setMenuBarVisibility(false);
  aboutWindow.loadFile(path.join(__dirname, 'about.html'));

  aboutWindow.on('closed', () => {
    aboutWindow = null;
  });
}

/**
 * Register IPC handlers for the About window. Safe to call once at startup.
 */
function registerIpc(getStatus) {
  if (typeof getStatus === 'function') statusProvider = getStatus;
  if (ipcRegistered) return;
  ipcRegistered = true;

  ipcMain.handle('about:get-info', () => {
    let iconDataUrl = '';
    try {
      const img = nativeImage
        .createFromPath(path.join(__dirname, '..', 'assets', 'app-icon.png'))
        .resize({ width: 120, height: 120, quality: 'best' });
      iconDataUrl = img.toDataURL();
    } catch (e) {
      iconDataUrl = '';
    }

    const live = statusProvider() || {};
    return {
      version: app.getVersion(),
      author: pkg.author || 'Kavisha Lakshan',
      license: pkg.license || 'MIT',
      iconDataUrl,
      discordStatus: live.discordStatus || 'Disconnected',
      stremioRunning: !!live.stremioRunning
    };
  });

  ipcMain.on('about:close', () => {
    if (aboutWindow) aboutWindow.close();
  });

  // Open only known, allow-listed external links in the system browser.
  ipcMain.on('about:open-link', (event, key) => {
    const url = ALLOWED_LINKS[key];
    if (url) shell.openExternal(url);
  });
}

module.exports = {
  openAboutWindow,
  registerIpc
};

