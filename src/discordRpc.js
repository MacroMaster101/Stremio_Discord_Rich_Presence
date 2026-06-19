/**
 * src/discordRpc.js
 * Manages the Discord Rich Presence (RPC) connection and updates.
 */

const RPC = require('discord-rpc');

let rpc = null;
let isConnected = false;
let reconnectTimer = null;
let clientId = '';
let startTimestamp = null;
let lastActiveTitle = null;
let statusCallback = null;

/**
 * Configure the client ID for Discord RPC.
 * @param {string} id - The Discord developer application client ID.
 */
function setClientId(id) {
  clientId = id;
}

/**
 * Register a callback to listen to connection status changes.
 * Used to update the tray menu state.
 * @param {function} callback - Callback function receiving a status string.
 */
function setStatusCallback(callback) {
  statusCallback = callback;
}

/**
 * Triggers the status callback to notify UI/Tray of status changes.
 * @param {string} status - Current status description.
 */
function triggerStatusChange(status) {
  if (statusCallback) {
    statusCallback(status);
  }
}

/**
 * Connect to Discord Local RPC client.
 * Handles failures and schedules reconnection.
 */
function connect() {
  if (isConnected) return;
  
  if (!clientId || clientId === 'YOUR_DISCORD_CLIENT_ID_HERE') {
    console.warn('Discord RPC: Invalid or missing Discord Client ID in config.');
    triggerStatusChange('Missing Client ID');
    return;
  }

  // Clear any existing reconnect timers before connecting
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  console.log('Discord RPC: Connecting...');
  triggerStatusChange('Connecting...');

  try {
    rpc = new RPC.Client({ transport: 'ipc' });

    rpc.on('ready', () => {
      console.log('Discord RPC: Successfully connected to Discord!');
      isConnected = true;
      triggerStatusChange('Connected');
    });

    rpc.on('disconnected', () => {
      console.log('Discord RPC: Disconnected from Discord.');
      handleDisconnect();
    });

    // Login to Discord with the Client ID
    rpc.login({ clientId }).catch((err) => {
      console.error(`Discord RPC login failed: ${err.message}`);
      handleDisconnect();
    });
  } catch (err) {
    console.error(`Discord RPC initialization failed: ${err.message}`);
    handleDisconnect();
  }
}

/**
 * Handles disconnection by resetting state and queuing a reconnect attempt.
 */
function handleDisconnect() {
  isConnected = false;
  triggerStatusChange('Disconnected');
  cleanupRpc();

  // Try to reconnect in 15 seconds
  if (!reconnectTimer) {
    console.log('Discord RPC: Scheduling reconnect in 15 seconds...');
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, 15000);
  }
}

/**
 * Destroys the RPC client instance to prevent resource/listener leaks.
 */
function cleanupRpc() {
  if (rpc) {
    try {
      rpc.destroy();
    } catch (e) {
      // Fail silently on destroy issues
    }
    rpc = null;
  }
}

/**
 * Update the Discord Rich Presence activity based on Stremio status.
 * @param {boolean} isStremioRunning - Whether Stremio is currently running.
 * @param {boolean} privacyMode - Whether privacy mode is enabled.
 * @param {object|null} media - Structured media info (see parseMediaInfo), or null.
 * @param {string|null} posterUrl - Optional poster image URL (from Cinemeta).
 */
function updatePresence(isStremioRunning, privacyMode, media, posterUrl) {
  if (!isConnected || !rpc) return;

  if (!isStremioRunning) {
    // If Stremio is closed, clear presence and reset timer
    clearPresence();
    return;
  }

  const activity = { instance: false };

  // Clickable buttons (shown to others viewing the presence). Max 2.
  activity.buttons = [
    { label: 'Get Stremio', url: 'https://www.stremio.com/downloads' }
  ];

  if (privacyMode) {
    // Generic presence when privacy mode is enabled — no title, no poster.
    activity.details = 'Watching Stremio';
    activity.largeImageKey = 'stremio';
    activity.largeImageText = 'Stremio';
    lastActiveTitle = null;
  } else {
    const title = media ? media.display : null;

    if (media && media.type === 'series') {
      // Line 1: show name. Line 2: episode (+ episode title).
      const ep = `S${String(media.season).padStart(2, '0')}E${String(media.episode).padStart(2, '0')}`;
      activity.details = media.name;
      activity.state = media.episodeTitle ? `${ep} · ${media.episodeTitle}` : ep;
    } else if (media) {
      activity.details = media.year ? `${media.name} (${media.year})` : media.name;
      activity.state = 'Watching a movie';
    } else {
      activity.details = 'Watching Stremio';
      activity.state = 'Using Stremio Desktop';
    }

    // Add a "Search" button for the current title.
    if (media && media.searchName) {
      activity.buttons.push({
        label: 'Search Title',
        url: `https://www.google.com/search?q=${encodeURIComponent(media.searchName)}`
      });
    }

    // Large image: poster if available, else the Stremio asset key.
    if (posterUrl) {
      activity.largeImageKey = posterUrl;
      activity.largeImageText = title || 'Stremio';
      // Small image overlays the Stremio logo as a badge in the corner.
      activity.smallImageKey = 'stremio';
      activity.smallImageText = 'Stremio Desktop';
    } else {
      activity.largeImageKey = 'stremio';
      activity.largeImageText = 'Stremio';
    }

    // Reset the elapsed timer when the title changes.
    if (title !== lastActiveTitle) {
      startTimestamp = Date.now();
      lastActiveTitle = title;
    } else if (!startTimestamp) {
      startTimestamp = Date.now();
    }
    activity.startTimestamp = startTimestamp;
  }

  rpc.setActivity(activity).catch((err) => {
    console.error(`Discord RPC: Failed to set activity: ${err.message}`);
  });
}

/**
 * Clears the active Discord Rich Presence.
 */
function clearPresence() {
  startTimestamp = null;
  lastActiveTitle = null;
  if (!isConnected || !rpc) return;

  rpc.clearActivity().catch((err) => {
    console.error(`Discord RPC: Failed to clear activity: ${err.message}`);
  });
}

/**
 * Manually close connection and clear reconnection timers.
 */
function disconnect() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  cleanupRpc();
  isConnected = false;
  triggerStatusChange('Disconnected');
}

module.exports = {
  setClientId,
  setStatusCallback,
  connect,
  disconnect,
  updatePresence,
  clearPresence,
  isConnected: () => isConnected
};
