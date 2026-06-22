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
let updateStatus = { state: 'idle', version: null, percent: null };
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
 * @param {function} [eventCallbacks.onRestartToUpdate] - "Restart to update" click.
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

/** @returns {string|null} Human-readable update state for the menu. */
function getUpdateStatusLabel() {
  switch (updateStatus.state) {
    case 'checking':
      return 'Checking for updates…';
    case 'downloading': {
      const percent = Number.isFinite(updateStatus.percent)
        ? ` ${Math.max(0, Math.min(100, Math.round(updateStatus.percent)))}%`
        : '';
      return `Downloading update${percent}…`;
    }
    case 'ready':
      return `Restart to update${updateStatus.version ? ` (v${updateStatus.version})` : ''}`;
    case 'error':
      return 'Update check failed';
    default:
      return null;
  }
}

/** @returns {Electron.MenuItemConstructorOptions} */
function getUpdateActionItem() {
  const label = getUpdateStatusLabel();

  if (updateStatus.state === 'ready') {
    return {
      label,
      click: () => callbacks.onRestartToUpdate && callbacks.onRestartToUpdate()
    };
  }

  if (updateStatus.state === 'checking' || updateStatus.state === 'downloading') {
    return { label, enabled: false };
  }

  return {
    label: 'Check for Updates…',
    click: () => callbacks.onCheckForUpdates && callbacks.onCheckForUpdates()
  };
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
    { type: 'separator' }
  ];

  const updateLabel = getUpdateStatusLabel();
  if (updateLabel) {
    template.push(
      updateStatus.state === 'ready'
        ? {
            label: `⭐  ${updateLabel}`,
            click: () => callbacks.onRestartToUpdate && callbacks.onRestartToUpdate()
          }
        : { label: updateLabel, enabled: false },
      { type: 'separator' }
    );
  }

  template.push(
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
      sublabel: 'Launch minimized at login',
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
    getUpdateActionItem(),
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
  );

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
 * Update tray-visible updater state.
 * @param {{state?: string, version?: string|null, percent?: number|null}} status
 */
function setUpdateStatus(status = {}) {
  updateStatus = {
    state: status.state || 'idle',
    version: Object.prototype.hasOwnProperty.call(status, 'version')
      ? status.version
      : updateStatus.version,
    percent: Number.isFinite(status.percent) ? status.percent : null
  };

  if (updateStatus.state === 'idle' || updateStatus.state === 'error') {
    updateStatus.version = updateStatus.state === 'idle' ? null : updateStatus.version;
    updateStatus.percent = null;
  }

  updateMenu();
}

/**
 * Mark that an update has been downloaded and is ready to install. Adds a
 * one-click "Restart to update" item to the top of the tray menu.
 * @param {string|null} version - The pending version, or null to clear it.
 */
function setUpdateReady(version) {
  setUpdateStatus({ state: version ? 'ready' : 'idle', version: version || null });
}

/**
 * Show a desktop notification (used for update messages).
 * Falls back silently if notifications aren't supported.
 * @param {string} title
 * @param {string} body
 * @param {function} [onClick] - Optional handler invoked when the toast is clicked.
 */
function showNotification(title, body, onClick) {
  try {
    if (Notification.isSupported()) {
      const n = new Notification({
        title,
        body,
        icon: trayIcon.getIcon('connected')
      });
      if (typeof onClick === 'function') {
        n.on('click', onClick);
      }
      n.show();
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
  setUpdateStatus,
  setUpdateReady,
  showNotification
};