/**
 * src/updater.js
 * In-app auto-update via electron-updater + GitHub Releases.
 *
 * Behavior:
 *   - On launch (and on manual "Check for Updates"), checks GitHub Releases.
 *   - If a newer version exists, downloads it in the background and reports
 *     download progress to the tray.
 *   - Once downloaded, the tray exposes a one-click silent restart/update.
 *
 * Notes:
 *   - Updates only work in the packaged app; in development the updater is a
 *     no-op (electron-updater requires app-update.yml that ships with builds).
 *   - The check is silent on "no update" unless triggered manually.
 */

const { app, autoUpdater: _unused } = require('electron');
let autoUpdater;
try {
  // Lazy require so a missing dependency in dev doesn't crash the app.
  ({ autoUpdater } = require('electron-updater'));
} catch (e) {
  autoUpdater = null;
}

let initialized = false;
let manualCheck = false;
// Optional callbacks supplied by main (e.g. to update tray state/notifications).
let notify = {};

/**
 * Wire up the updater. Safe to call once at startup.
 * @param {object} callbacks
 * @param {function} [callbacks.onChecking] - ({ manual }) => void
 * @param {function} [callbacks.onUpdateAvailable] - (info) => void
 * @param {function} [callbacks.onDownloadProgress] - (progress) => void
 * @param {function} [callbacks.onUpdateDownloaded] - (info) => void
 * @param {function} [callbacks.onNoUpdate] - () => void   (only fired on manual checks)
 * @param {function} [callbacks.onError] - (err) => void   (only surfaced on manual checks)
 */
function init(callbacks = {}) {
  notify = callbacks;
  if (initialized || !autoUpdater) return;
  initialized = true;

  // Download automatically, but only install when the user chooses restart or
  // when the app quits. quitAndInstall() below uses silent install + relaunch.
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    console.log(`Updater: update available -> ${info.version}`);
    if (notify.onUpdateAvailable) notify.onUpdateAvailable(info);
  });

  autoUpdater.on('download-progress', (progress) => {
    if (notify.onDownloadProgress) notify.onDownloadProgress(progress);
  });

  autoUpdater.on('update-not-available', () => {
    console.log('Updater: no update available.');
    if (manualCheck && notify.onNoUpdate) notify.onNoUpdate();
    manualCheck = false;
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log(`Updater: update downloaded -> ${info.version} (ready to install)`);
    manualCheck = false;
    if (notify.onUpdateDownloaded) notify.onUpdateDownloaded(info);
  });

  autoUpdater.on('error', (err) => {
    console.error(`Updater error: ${err == null ? 'unknown' : (err.message || err)}`);
    if (manualCheck && notify.onError) notify.onError(err);
    manualCheck = false;
  });
}

/**
 * Trigger an update check. No-op (with optional callback) when not packaged.
 * @param {boolean} isManual - True when triggered by the user ("Check for Updates").
 */
function checkForUpdates(isManual = false) {
  if (notify.onChecking) notify.onChecking({ manual: isManual });

  if (!autoUpdater || !app.isPackaged) {
    if (isManual && notify.onNoUpdate) notify.onNoUpdate();
    return;
  }

  manualCheck = isManual;
  autoUpdater.checkForUpdates().catch((err) => {
    console.error(`Updater check failed: ${err.message}`);
    if (isManual && notify.onError) notify.onError(err);
  });
}

/**
 * Silently install a downloaded update and relaunch the app.
 */
function quitAndInstall() {
  if (autoUpdater) autoUpdater.quitAndInstall(true, true);
}

module.exports = {
  init,
  checkForUpdates,
  quitAndInstall
};