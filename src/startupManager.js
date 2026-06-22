/**
 * src/startupManager.js
 * Keeps Windows login startup registration stable and removes legacy entries
 * left by older builds.
 */

const { app } = require('electron');
const { spawnSync } = require('child_process');

const STARTUP_NAME = 'Stremio Discord Presence';
const HIDDEN_ARGS = ['--hidden'];

const LEGACY_STARTUP_NAMES = [
  'electron.app.Stremio Discord Presence',
  'StremioDiscordPresence',
  'com.kavishalakshan.stremiodiscordpresence'
];

const HKCU_RUN_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';
const HKCU_STARTUP_APPROVED_RUN_KEY =
  'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\Run';

/**
 * Quote a Windows command-line argument when Electron will write it into Run.
 * @param {string} value
 * @returns {string}
 */
function quoteArg(value) {
  return /\s/.test(value) ? '"' + value + '"' : value;
}

/**
 * Arguments needed to launch this app at login.
 * Packaged builds launch the exe directly; development runs must pass the app
 * directory to Electron.
 * @returns {string[]}
 */
function getLaunchArgs() {
  return app.isPackaged ? HIDDEN_ARGS : [quoteArg(app.getAppPath()), ...HIDDEN_ARGS];
}

/**
 * Electron requires the same path/args/name for set and get, otherwise
 * getLoginItemSettings().openAtLogin can report the wrong checkbox state.
 * @returns {Electron.LoginItemSettingsOptions}
 */
function getLoginItemOptions() {
  const options = {
    args: getLaunchArgs()
  };

  if (process.platform === 'win32') {
    options.name = STARTUP_NAME;
    options.path = process.execPath;
  }

  return options;
}

/**
 * Delete a single registry value if it exists. Missing values are fine.
 * @param {string} key
 * @param {string} valueName
 */
function deleteRegistryValue(key, valueName) {
  const result = spawnSync('reg.exe', ['delete', key, '/v', valueName, '/f'], {
    windowsHide: true,
    stdio: 'ignore'
  });

  if (result.error) {
    console.error(`Startup cleanup failed for ${valueName}: ${result.error.message}`);
  }
}

/**
 * Remove startup values created by older builds so Task Manager does not show
 * duplicates or stale entries after upgrading.
 */
function cleanupLegacyEntries() {
  if (process.platform !== 'win32') return;

  for (const name of LEGACY_STARTUP_NAMES) {
    deleteRegistryValue(HKCU_RUN_KEY, name);
    deleteRegistryValue(HKCU_STARTUP_APPROVED_RUN_KEY, name);
  }
}

/**
 * Preserve an enabled startup setting from older builds, then remove duplicate
 * legacy values.
 */
function migrateLegacyEntries() {
  if (process.platform !== 'win32') return;

  if (!isEnabled()) {
    const legacyWasEnabled = LEGACY_STARTUP_NAMES.some((name) => {
      const settings = app.getLoginItemSettings({
        ...getLoginItemOptions(),
        name
      });

      return settings.openAtLogin;
    });

    if (legacyWasEnabled) {
      app.setLoginItemSettings({
        ...getLoginItemOptions(),
        openAtLogin: true,
        enabled: true
      });
    }
  }

  cleanupLegacyEntries();
}

/**
 * Whether this app is configured to launch at Windows login.
 * @returns {boolean}
 */
function isEnabled() {
  return app.getLoginItemSettings(getLoginItemOptions()).openAtLogin;
}

/**
 * Enable or disable launching the app at login.
 * @param {boolean} enabled
 * @returns {boolean} The state reported by Electron after the update.
 */
function setEnabled(enabled) {
  app.setLoginItemSettings({
    ...getLoginItemOptions(),
    openAtLogin: enabled,
    enabled
  });

  cleanupLegacyEntries();
  return isEnabled();
}

module.exports = {
  cleanupLegacyEntries,
  migrateLegacyEntries,
  isEnabled,
  setEnabled
};