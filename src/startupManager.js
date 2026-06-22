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
 * Quote a Windows command-line argument for a Run registry command string.
 * @param {string} value
 * @returns {string}
 */
function quoteArg(value) {
  const escaped = String(value).replace(/"/g, '\\"');
  return '"' + escaped + '"';
}

/**
 * Arguments needed to launch this app at login.
 * Packaged builds launch the exe directly; development runs must pass the app
 * directory to Electron.
 * @returns {string[]}
 */
function getLaunchArgs() {
  return app.isPackaged ? HIDDEN_ARGS : [app.getAppPath(), ...HIDDEN_ARGS];
}

/**
 * The executable and args Electron should use for non-Windows login items.
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
 * Command string written to HKCU Run on Windows.
 * @returns {string}
 */
function getWindowsRunCommand() {
  return [process.execPath, ...getLaunchArgs()].map(quoteArg).join(' ');
}

/**
 * Run reg.exe with arguments.
 * @param {string[]} args
 * @returns {import('child_process').SpawnSyncReturns<Buffer>}
 */
function reg(args) {
  return spawnSync('reg.exe', args, {
    windowsHide: true,
    encoding: 'utf8'
  });
}

/**
 * Whether a registry value exists.
 * @param {string} key
 * @param {string} valueName
 * @returns {boolean}
 */
function registryValueExists(key, valueName) {
  return reg(['query', key, '/v', valueName]).status === 0;
}

/**
 * Write a REG_SZ registry value.
 * @param {string} key
 * @param {string} valueName
 * @param {string} value
 */
function setRegistryValue(key, valueName, value) {
  const result = reg(['add', key, '/v', valueName, '/t', 'REG_SZ', '/d', value, '/f']);
  if (result.status !== 0) {
    const message = result.stderr || result.stdout || 'unknown registry write error';
    throw new Error(`Failed to set startup registry value: ${message}`);
  }
}

/**
 * Delete a single registry value if it exists. Missing values are fine.
 * @param {string} key
 * @param {string} valueName
 */
function deleteRegistryValue(key, valueName) {
  reg(['delete', key, '/v', valueName, '/f']);
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

  const legacyWasEnabled = LEGACY_STARTUP_NAMES.some((name) =>
    registryValueExists(HKCU_RUN_KEY, name)
  );

  if (!isEnabled() && legacyWasEnabled) {
    setEnabled(true);
  } else {
    cleanupLegacyEntries();
  }
}

/**
 * Whether this app is configured to launch at Windows login.
 * @returns {boolean}
 */
function isEnabled() {
  if (process.platform === 'win32') {
    return registryValueExists(HKCU_RUN_KEY, STARTUP_NAME);
  }

  return app.getLoginItemSettings(getLoginItemOptions()).openAtLogin;
}

/**
 * Enable or disable launching the app at login.
 * @param {boolean} enabled
 * @returns {boolean} The state after the update.
 */
function setEnabled(enabled) {
  if (process.platform === 'win32') {
    if (enabled) {
      setRegistryValue(HKCU_RUN_KEY, STARTUP_NAME, getWindowsRunCommand());
      deleteRegistryValue(HKCU_STARTUP_APPROVED_RUN_KEY, STARTUP_NAME);
    } else {
      deleteRegistryValue(HKCU_RUN_KEY, STARTUP_NAME);
      deleteRegistryValue(HKCU_STARTUP_APPROVED_RUN_KEY, STARTUP_NAME);
    }

    cleanupLegacyEntries();
    return isEnabled();
  }

  app.setLoginItemSettings({
    ...getLoginItemOptions(),
    openAtLogin: enabled,
    enabled
  });

  return isEnabled();
}

module.exports = {
  cleanupLegacyEntries,
  migrateLegacyEntries,
  isEnabled,
  setEnabled
};