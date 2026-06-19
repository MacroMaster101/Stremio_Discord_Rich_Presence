/**
 * src/config.js
 * Provides app configuration. The Discord Client ID is built in (see CLIENT_ID
 * below). Optional .env values (POLL_INTERVAL_MS, PRIVACY_MODE) are loaded for
 * development/advanced use from, in order: next to the executable (packaged) /
 * project root (dev), then the current working directory.
 */

const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const { app } = require('electron');

/**
 * Determine the directory where the user-editable .env should live.
 * - Packaged: the folder containing the .exe (resourcesPath's parent).
 * - Development: the project root (one level up from src/).
 */
function getEnvSearchPaths() {
  const paths = [];

  if (app && app.isPackaged) {
    // .../resources/app.asar -> we want the install dir containing the .exe
    paths.push(path.join(path.dirname(process.execPath), '.env'));
    // Also allow placing it inside the resources folder
    paths.push(path.join(process.resourcesPath, '.env'));
  } else {
    paths.push(path.join(__dirname, '..', '.env'));
  }

  // Fallback to the current working directory in all cases
  paths.push(path.join(process.cwd(), '.env'));

  return paths;
}

// Load the first .env file that actually exists
for (const envPath of getEnvSearchPaths()) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    break;
  }
}

/**
 * Built-in Discord Application (Client) ID that ships with the app.
 * A Discord Application ID is a public identifier (not a secret), so it is safe
 * to bundle. Sharing one ID across all users is intended and conflict-free — it
 * just gives everyone the same app name and artwork in their Discord presence.
 */
const CLIENT_ID = '1511758462089035988';

// Export config variables with sensible defaults.
// The Client ID is built in; poll interval and privacy default remain
// configurable via .env for development/advanced use.
module.exports = {
  clientId: CLIENT_ID,
  pollInterval: parseInt(process.env.POLL_INTERVAL_MS, 10) || 5000,
  initialPrivacyMode: process.env.PRIVACY_MODE === 'true'
};
