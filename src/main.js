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

// Whether to fetch poster art via Cinemeta (toggleable from the tray; default on).
let showPosters = true;

/**
 * Whether the app is configured to launch automatically at Windows login.
 * @returns {boolean}
 */
function isAutoStartEnabled() {
  return app.getLoginItemSettings().openAtLogin;
}

/**
 * Enable or disable launching the app at Windows login.
 * @param {boolean} enabled
 */
function setAutoStart(enabled) {
  app.setLoginItemSettings({
    openAtLogin: enabled,
    // Start minimized to tray (no flashing window) on login.
    args: ['--hidden']
  });
  console.log(`Auto-start at login ${enabled ? 'enabled' : 'disabled'}.`);
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

/**
 * Perform a single check of the Stremio process status and update RPC/Tray.
 */
async function runDetection() {
  try {
    const isRunning = await checkIfStremioRunning();
    
    // Update the system tray status text
    trayManager.updateStremioStatus(isRunning);

    // Fetch the currently playing media (structured) from Stremio's local server
    let media = null;
    if (isRunning) {
      media = await getPlayingMedia();
    }
    const title = media ? media.display : null;

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

  // 0. Register IPC handlers for the about window
  aboutWindow.registerIpc();

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
      trayManager.showNotification('Stremio Discord Presence', 'Checking for updates…');
      updater.checkForUpdates(true);
    },
    onAbout: () => {
      aboutWindow.openAboutWindow();
    },
    onQuit: () => {
      shutdown();
    }
  });

  // 2b. Initialize the auto-updater and check on launch.
  updater.init({
    onUpdateAvailable: (info) => {
      trayManager.showNotification(
        'Update available',
        `Downloading version ${info.version} in the background…`
      );
    },
    onUpdateDownloaded: (info) => {
      trayManager.showNotification(
        'Update ready',
        `Version ${info.version} will be installed when you quit the app.`
      );
    },
    onNoUpdate: () => {
      trayManager.showNotification(
        'Stremio Discord Presence',
        'You’re already on the latest version.'
      );
    },
    onError: () => {
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
});
