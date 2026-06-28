/**
 * src/main.js
 * Main Electron entry point. Coordinates detection, Discord RPC, and system tray.
 */

const { app } = require('electron');
const config = require('./config');
const { checkIfStremioRunning, getPlayingMedia } = require('./stremioDetector');
const discordRpc = require('./discordRpc');
const trayManager = require('./tray');
const aboutWindow = require('./aboutWindow');
const cinemeta = require('./cinemeta');
const updater = require('./updater');
const startupManager = require('./startupManager');

// Whether to fetch poster art via Cinemeta (toggleable from the tray; default on).
let showPosters = true;


/**
 * Whether the app is configured to launch automatically at Windows login.
 * @returns {boolean}
 */
function isAutoStartEnabled() {
  return startupManager.isEnabled();
}

/**
 * Enable or disable launching the app at Windows login.
 *
 * @param {boolean} enabled
 */
function setAutoStart(enabled) {
  const active = startupManager.setEnabled(enabled);
  console.log(`Auto-start at login ${active ? 'enabled' : 'disabled'}.`);
  return active;
}

// Lock the app to a single instance
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  console.log('Another instance of Stremio Discord Presence is already running. Exiting...');
  app.quit();
  process.exit(0);
}

// Hide the dock icon on macOS (since this is a background tray-only app)
if (process.platform === 'darwin' && app.dock) {
  app.dock.hide();
}

let lastRunningState = null;
let lastPrivacyModeState = null;
let lastTitleState = null;
let currentPrivacyMode = config.initialPrivacyMode;
let pollingInterval = null;

// Current live state, surfaced to the About window's status pills.
let currentDiscordStatus = 'Disconnected';
let currentStremioRunning = false;

/**
 * Perform a single check of the Stremio process status and update RPC/Tray.
 */
async function runDetection() {
  try {
    const isRunning = await checkIfStremioRunning();
    currentStremioRunning = isRunning;

    // Fetch the currently playing media (structured) from Stremio's local server
    let media = null;
    if (isRunning) {
      media = await getPlayingMedia();
    }
    const title = media ? media.display : null;

    // Update the system tray status (running + active title for the menu).
    trayManager.updateStremioStatus(isRunning, title);

    // If running state, privacy mode, or active title changes, update Discord activity
    const runningChanged = isRunning !== lastRunningState;
    const privacyChanged = currentPrivacyMode !== lastPrivacyModeState;
    const titleChanged = title !== lastTitleState;

    if (runningChanged || privacyChanged || titleChanged) {
      console.log(`Stremio State change: Running = ${isRunning}, Privacy Mode = ${currentPrivacyMode}, Title = ${title}`);

      // Fetch poster art when enabled, not in privacy mode, and we have media.
      let posterUrl = null;
      if (media && !currentPrivacyMode && showPosters && cinemeta.isAvailable()) {
        try {
          posterUrl = await cinemeta.getPosterUrl(media);
        } catch (e) {
          posterUrl = null;
        }
      }

      discordRpc.updatePresence(isRunning, currentPrivacyMode, media, posterUrl);

      lastRunningState = isRunning;
      lastPrivacyModeState = currentPrivacyMode;
      lastTitleState = title;
    }
  } catch (error) {
    console.error('Error in detection loop:', error);
  }
}

/**
 * Initializes the application modules.
 */
function init() {
  console.log('Stremio Discord Presence starting...');
  startupManager.migrateLegacyEntries();

  // 0. Register IPC handlers for the about window, with a live-status provider
  //    so the About window's pills reflect the real Discord/Stremio state.
  aboutWindow.registerIpc(() => ({
    discordStatus: currentDiscordStatus,
    stremioRunning: currentStremioRunning
  }));

  // 1. Initialize Discord RPC configuration
  discordRpc.setClientId(config.clientId);

  // 2. Initialize the System Tray
  trayManager.createTray(currentPrivacyMode, {
    onPrivacyModeToggle: (enabled) => {
      currentPrivacyMode = enabled;
      // Force an immediate detection tick to push the new privacy status to Discord
      runDetection();
    },
    onReconnect: () => {
      console.log('User requested manual Discord RPC reconnection.');
      discordRpc.connect();
    },
    onToggleAutoStart: (enabled) => {
      setAutoStart(enabled);
    },
    isAutoStartEnabled: () => isAutoStartEnabled(),
    onTogglePosters: (enabled) => {
      showPosters = enabled;
      // Re-push presence so the poster appears/disappears immediately.
      lastTitleState = null;
      runDetection();
    },
    arePostersEnabled: () => showPosters,
    isPosterFeatureAvailable: () => cinemeta.isAvailable(),
    onCheckForUpdates: () => {
      console.log('User requested a manual update check.');
      updater.checkForUpdates(true);
    },
    onAbout: () => {
      aboutWindow.openAboutWindow();
    },
    onRestartToUpdate: () => {
      console.log('User chose to restart and install the downloaded update.');
      restartToUpdate();
    },
    onQuit: () => {
      shutdown();
    }
  });

  // 2b. Initialize the auto-updater and check on launch.
  updater.init({
    onChecking: ({ manual }) => {
      // Only surface a visible "Checking…" state for user-initiated checks.
      // The silent startup check must not leave the menu stuck on "Checking…"
      // when no update exists (update-not-available is suppressed for silent
      // checks, so nothing would reset it).
      if (manual) {
        trayManager.setUpdateStatus({ state: 'checking', showMenu: true });
      }
    },
    onUpdateAvailable: (info) => {
      trayManager.setUpdateStatus({ state: 'downloading', version: info.version, percent: 0 });
      trayManager.showNotification(
        'Update available',
        `Downloading version ${info.version} in the background...`
      );
    },
    onDownloadProgress: (progress) => {
      trayManager.setUpdateStatus({ state: 'downloading', percent: progress.percent });
    },
    onUpdateDownloaded: (info) => {
      // Expose a clickable "Restart to update" item rather than yanking the app
      // out from under the user. If quitAndInstall silently fails (installer
      // can't elevate, file lock, etc.) the user still has a working menu.
      trayManager.setUpdateStatus({ state: 'ready', version: info.version });
      trayManager.showNotification(
        'Update ready',
        `Version ${info.version} downloaded. Click to restart and update.`,
        () => restartToUpdate()
      );
    },
    onNoUpdate: () => {
      trayManager.setUpdateStatus({ state: 'idle' });
      trayManager.showNotification(
        'Stremio Discord Presence',
        'You are already on the latest version.'
      );
    },
    onError: () => {
      trayManager.setUpdateStatus({ state: 'error' });
      trayManager.showNotification(
        'Update check failed',
        'Could not check for updates. Please try again later.'
      );
    }
  });
  // Check shortly after startup so it doesn't compete with initial connection.
  setTimeout(() => updater.checkForUpdates(false), 8000);

  // 3. Register status listener to update system tray and trigger immediate updates on connection
  discordRpc.setStatusCallback((status) => {
    currentDiscordStatus = status;
    trayManager.updateDiscordStatus(status);

    if (status === 'Connected') {
      // Reset state tracking to force the next poll to push activity
      lastRunningState = null;
      lastPrivacyModeState = null;
      lastTitleState = null;
      runDetection();
    }
  });

  // 4. Connect to Discord RPC (Client ID is built in)
  discordRpc.connect();

  // 5. Start the polling detector loop
  runDetection(); // Initial run
  pollingInterval = setInterval(runDetection, config.pollInterval);
}

/**
 * Performs cleanup and shuts down the application.
 */
function shutdown() {
  console.log('Shutting down Stremio Discord Presence...');

  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }

  discordRpc.disconnect();
  app.quit();
}

// Guard so a double-click on "Restart to update" can't launch two installers.
let installLaunched = false;

/**
 * Cleanly tear down, then quit and install the downloaded update.
 * Used by the "Restart to update" tray item and the update notification click.
 *
 * The actual install + relaunch is performed by electron-updater's
 * quitAndInstall (non-silent), which launches the installer and then quits the
 * app on a later tick. We must NOT call app.quit() ourselves or release/hold
 * anything that would race that — we just tear down our own subsystems and
 * hand off. The single-instance lock is released in will-quit (see below) so
 * the installer isn't blocked by the still-running instance.
 */
function restartToUpdate() {
  if (installLaunched) return;

  trayManager.setUpdateStatus({ state: 'installing' });

  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
  discordRpc.disconnect();

  let launched = false;
  try {
    launched = updater.quitAndInstall();
  } catch (e) {
    console.error(`Restart to update failed: ${e.message}`);
    launched = false;
  }

  if (launched) {
    installLaunched = true;
    // Safety net: if for any reason the installer didn't take over and quit the
    // app within a few seconds, restore a usable "ready" state so the user can
    // retry rather than being stuck on "Installing…".
    setTimeout(() => {
      if (installLaunched) {
        console.warn('Updater: install did not complete; restoring ready state.');
        installLaunched = false;
        trayManager.setUpdateStatus({ state: 'ready' });
        trayManager.showNotification(
          'Update could not start',
          'The installer did not launch. Please download the latest version manually.'
        );
      }
    }, 10000);
  } else {
    trayManager.setUpdateStatus({ state: 'ready' });
    trayManager.showNotification(
      'Update could not start',
      'Restarting to update failed. Please quit and reinstall manually.'
    );
  }
}

// Electron application lifecycle hooks
app.whenReady().then(init);

// Prevent app from quitting when all windows are closed, as there are no windows by design
app.on('window-all-closed', (event) => {
  event.preventDefault();
});

// Clean cleanup on quit
app.on('will-quit', () => {
  if (pollingInterval) {
    clearInterval(pollingInterval);
  }
  discordRpc.disconnect();
  // Release the single-instance lock so the installer's freshly relaunched
  // copy can acquire it without colliding with this dying instance.
  app.releaseSingleInstanceLock();
});
