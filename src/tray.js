/**
 * src/tray.js
 * Manages the system tray icon, tooltips, context menus, and event handlers.
 *
 * The menu is grouped into status (read-only), quick actions, settings, and
 * app actions. The tray icon itself reflects the Discord connection state via
 * a colored status dot (see trayIcon.js).
 */

const { Tray, Menu, app, Notification, nativeTheme } = require('electron');
const trayIcon = require('./trayIcon');

let tray = null;
let discordStatus = 'Disconnected';
let stremioRunning = false;
let activeTitle = null; // current media title when something is playing, else null
let privacyMode = false;
let callbacks = {};

// Emoji indicators keyed by Discord connection status.
const DISCORD_BADGE = {
  Connected: '🟢',
  'Connecting...': '🟡',
  'Missing Client ID': '⚪',
  Disconnected: '🔴'
};

/**
 * Creates the system tray icon and sets up its initial context menu.
 *
 * @param {boolean} initialPrivacyMode - Initial state of the privacy checkbox.
 * @param {object} eventCallbacks - Handlers for user interactions.
 * @param {function} eventCallbacks.onPrivacyModeToggle - Privacy checkbox toggle.
 * @param {function} eventCallbacks.onReconnect - Manual "Reconnect Discord" click.
 * @param {function} eventCallbacks.onToggleAutoStart - "Start with Windows" toggle; receives boolean.
 * @param {function} [eventCallbacks.onTogglePosters] - "Show Poster Art" toggle; receives boolean.
 * @param {function} [eventCallbacks.arePostersEnabled] - Returns current posters-enabled boolean.
 * @param {function} [eventCallbacks.isPosterFeatureAvailable] - Returns whether poster lookups are available.
 * @param {function} [eventCallbacks.onCheckForUpdates] - "Check for Updates…" click.
 * @param {function} eventCallbacks.onAbout - "About" click.
 * @param {function} eventCallbacks.onQuit - "Quit" click.
 * @param {function} [eventCallbacks.isAutoStartEnabled] - Returns current autostart boolean.
 * @returns {Electron.Tray} The instantiated tray object.
 */
function createTray(initialPrivacyMode, eventCallbacks) {
  privacyMode = initialPrivacyMode;
  callbacks = eventCallbacks;

  tray = new Tray(trayIcon.getIcon('disconnected'));
  tray.setToolTip('Stremio Discord Presence');

  // Left-click opens the menu too (Windows convention is right-click, but this
  // makes the app feel more responsive).
  tray.on('click', () => tray.popUpContextMenu());

  updateMenu();
  refreshIcon();

  // Re-render the status icon when the OS theme flips so its outline keeps
  // contrasting with the new (light/dark) taskbar.
  try {
    nativeTheme.on('updated', () => refreshIcon());
  } catch (e) {
    // Best-effort; safe to ignore if events are unavailable.
  }

  return tray;
}

/**
 * Shorten a string to a max length with an ellipsis, for menu labels.
 * @param {string} s
 * @param {number} max
 * @returns {string}
 */
function truncate(s, max) {
  if (!s) return s;
  return s.length > max ? s.slice(0, max - 1).trimEnd() + '…' : s;
}

/**
 * Returns whether "Start with Windows" is currently enabled, via the callback.
 * @returns {boolean}
 */
function autoStartEnabled() {
  return typeof callbacks.isAutoStartEnabled === 'function'
    ? !!callbacks.isAutoStartEnabled()
    : false;
}

/** @returns {boolean} Whether poster art is currently enabled. */
function postersEnabled() {
  return typeof callbacks.arePostersEnabled === 'function'
    ? !!callbacks.arePostersEnabled()
    : false;
}

/** @returns {boolean} Whether the poster feature is available. */
function posterFeatureAvailable() {
  return typeof callbacks.isPosterFeatureAvailable === 'function'
    ? !!callbacks.isPosterFeatureAvailable()
    : false;
}

/**
 * Re-builds and updates the system tray context menu to reflect the latest status.
 */
function updateMenu() {
  if (!tray) return;

  const discordBadge = DISCORD_BADGE[discordStatus] || '🔴';

  // Three Stremio states: closed, open & browsing, open & watching something.
  let stremioBadge;
  let stremioText;
  if (!stremioRunning) {
    stremioBadge = '⏹️';
    stremioText = 'Not running';
  } else if (activeTitle && !privacyMode) {
    stremioBadge = '▶️';
    stremioText = `Watching · ${truncate(activeTitle, 32)}`;
  } else if (stremioRunning) {
    stremioBadge = '🟣';
    stremioText = 'Browsing';
  }

  const template = [
    { label: 'Stremio Discord Presence', enabled: false },
    { type: 'separator' },
    { label: `${discordBadge}  Discord — ${discordStatus}`, enabled: false },
    { label: `${stremioBadge}  Stremio — ${stremioText}`, enabled: false },
    { type: 'separator' },
    { label: 'Settings', enabled: false },
    {
      label: 'Privacy Mode',
      sublabel: 'Hide what you’re watching',
      type: 'checkbox',
      checked: privacyMode,
      click: (menuItem) => {
        privacyMode = menuItem.checked;
        if (callbacks.onPrivacyModeToggle) {
          callbacks.onPrivacyModeToggle(privacyMode);
        }
        updateMenu();
      }
    },
    {
      label: 'Start with Windows',
      type: 'checkbox',
      checked: autoStartEnabled(),
      click: (menuItem) => {
        if (callbacks.onToggleAutoStart) {
          callbacks.onToggleAutoStart(menuItem.checked);
        }
        updateMenu();
      }
    },
    {
      label: 'Show Poster Art',
      sublabel: 'Fetches a poster from Stremio’s metadata',
      type: 'checkbox',
      checked: postersEnabled(),
      enabled: posterFeatureAvailable(),
      click: (menuItem) => {
        if (callbacks.onTogglePosters) {
          callbacks.onTogglePosters(menuItem.checked);
        }
        updateMenu();
      }
    },
    { type: 'separator' },
    {
      label: 'Reconnect Discord',
      click: () => callbacks.onReconnect && callbacks.onReconnect()
    },
    {
      label: 'Check for Updates…',
      click: () => callbacks.onCheckForUpdates && callbacks.onCheckForUpdates()
    },
    {
      label: 'About',
      click: () => callbacks.onAbout && callbacks.onAbout()
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        if (callbacks.onQuit) {
          callbacks.onQuit();
        } else {
          app.quit();
        }
      }
    }
  ];

  tray.setContextMenu(Menu.buildFromTemplate(template));
}

/**
 * Update the tray icon and tooltip to reflect the current Discord status.
 */
function refreshIcon() {
  if (!tray) return;
  const key = trayIcon.statusForDiscord(discordStatus);
  tray.setImage(trayIcon.getIcon(key));

  const stremioText = stremioRunning ? 'Running' : 'Not running';
  tray.setToolTip(
    `Stremio Discord Presence\nDiscord: ${discordStatus}\nStremio: ${stremioText}`
  );
}

/**
 * Dynamically updates the Discord status display in the system tray.
 * @param {string} status - New Discord connection status.
 */
function updateDiscordStatus(status) {
  discordStatus = status;
  updateMenu();
  refreshIcon();
}

/**
 * Dynamically updates the Stremio status display in the system tray.
 * @param {boolean} isRunning - Whether the Stremio process is running.
 * @param {string|null} [title] - Current media title if something is playing.
 */
function updateStremioStatus(isRunning, title) {
  stremioRunning = isRunning;
  activeTitle = isRunning ? (title || null) : null;
  updateMenu();
  refreshIcon();
}

/**
 * Show a desktop notification (used for update messages).
 * Falls back silently if notifications aren't supported.
 * @param {string} title
 * @param {string} body
 */
function showNotification(title, body) {
  try {
    if (Notification.isSupported()) {
      new Notification({
        title,
        body,
        icon: trayIcon.getIcon('connected')
      }).show();
    }
  } catch (e) {
    // Non-fatal — notifications are a nicety, not required.
    console.error(`Tray notification failed: ${e.message}`);
  }
}

module.exports = {
  createTray,
  updateDiscordStatus,
  updateStremioStatus,
  showNotification
};
