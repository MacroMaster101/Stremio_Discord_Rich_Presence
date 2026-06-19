/**
 * src/trayIcon.js
 * Builds dynamic tray icons by compositing a small colored status dot onto the
 * base tray icon. Keeps a single source image (assets/tray-icon.png) and derives the
 * connected / connecting / disconnected variants at runtime — no extra files.
 */

const path = require('path');
const zlib = require('zlib');
const { nativeImage } = require('electron');

// Tray icons render small; 32x32 is crisp on Windows without being heavy.
const ICON_SIZE = 32;
// Status dot geometry (in the 32x32 space), anchored to the bottom-right.
const DOT_RADIUS = 7;
const DOT_CENTER_X = ICON_SIZE - DOT_RADIUS - 1;
const DOT_CENTER_Y = ICON_SIZE - DOT_RADIUS - 1;

// Status colors (RGB).
const COLORS = {
  connected: [59, 165, 92], // green  (#3ba55c)
  connecting: [250, 166, 26], // amber (#faa61a)
  disconnected: [237, 66, 69], // red  (#ed4245)
  idle: [148, 155, 164] // gray     (#949ba4)
};

let baseIconCache = null;
const variantCache = new Map();

/**
 * Write a 4-byte big-endian unsigned integer into a buffer at offset.
 */
function writeUInt32BE(value) {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(value >>> 0, 0);
  return b;
}

/**
 * Build a PNG chunk (length + type + data + CRC32).
 */
function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'latin1');
  const body = Buffer.concat([typeBuf, data]);
  const crc = crc32(body);
  return Buffer.concat([writeUInt32BE(data.length), body, writeUInt32BE(crc)]);
}

// Standard CRC32 (used by PNG chunks).
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * Generate an RGBA PNG buffer of the given size containing a single filled,
 * anti-aliased circle (the status dot) over a transparent background.
 * @param {[number,number,number]} rgb
 * @returns {Buffer} PNG file bytes.
 */
function makeDotPng(rgb) {
  const size = ICON_SIZE;
  const bytesPerPixel = 4;
  const stride = size * bytesPerPixel;
  // Raw image: one extra filter byte (0) per scanline.
  const raw = Buffer.alloc((stride + 1) * size, 0);

  for (let y = 0; y < size; y++) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0; // filter type "none"
    for (let x = 0; x < size; x++) {
      // Anti-aliased coverage based on distance from the dot center.
      const dx = x + 0.5 - DOT_CENTER_X;
      const dy = y + 0.5 - DOT_CENTER_Y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const coverage = Math.max(0, Math.min(1, DOT_RADIUS - dist + 0.5));
      if (coverage <= 0) continue;

      const px = rowStart + 1 + x * bytesPerPixel;
      raw[px] = rgb[0];
      raw[px + 1] = rgb[1];
      raw[px + 2] = rgb[2];
      raw[px + 3] = Math.round(coverage * 255);
    }
  }

  const ihdr = Buffer.concat([
    writeUInt32BE(size),
    writeUInt32BE(size),
    Buffer.from([8, 6, 0, 0, 0]) // 8-bit depth, color type 6 (RGBA)
  ]);

  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), // signature
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0))
  ]);

  return png;
}

/**
 * Load and cache the base app icon, resized to the tray icon size.
 * @returns {Electron.NativeImage}
 */
function getBaseIcon() {
  if (!baseIconCache) {
    const iconPath = path.join(__dirname, '..', 'assets', 'tray-icon.png');
    baseIconCache = nativeImage
      .createFromPath(iconPath)
      .resize({ width: ICON_SIZE, height: ICON_SIZE, quality: 'best' });
  }
  return baseIconCache;
}

/**
 * Build (and cache) a tray icon for the given status, compositing the colored
 * status dot onto the base icon.
 *
 * @param {'connected'|'connecting'|'disconnected'|'idle'} status
 * @returns {Electron.NativeImage}
 */
function getIcon(status) {
  const key = COLORS[status] ? status : 'idle';
  if (variantCache.has(key)) return variantCache.get(key);

  const base = getBaseIcon();
  let composed;
  try {
    const dot = nativeImage.createFromBuffer(makeDotPng(COLORS[key]));
    // Overlay the dot on top of the base icon.
    composed = compositeOnto(base, dot);
  } catch (err) {
    console.error(`TrayIcon: failed to compose status icon: ${err.message}`);
    composed = base; // graceful fallback to the plain icon
  }

  variantCache.set(key, composed);
  return composed;
}

/**
 * Composite an overlay image on top of a base image of the same size, blending
 * by the overlay's alpha. Returns a new nativeImage.
 * @param {Electron.NativeImage} base
 * @param {Electron.NativeImage} overlay
 * @returns {Electron.NativeImage}
 */
function compositeOnto(base, overlay) {
  const size = { width: ICON_SIZE, height: ICON_SIZE };
  const baseBuf = base.toBitmap(); // BGRA
  const overBuf = overlay.toBitmap(); // BGRA
  const out = Buffer.from(baseBuf);

  for (let i = 0; i < out.length; i += 4) {
    const oa = overBuf[i + 3] / 255;
    if (oa <= 0) continue;
    out[i] = Math.round(overBuf[i] * oa + out[i] * (1 - oa)); // B
    out[i + 1] = Math.round(overBuf[i + 1] * oa + out[i + 1] * (1 - oa)); // G
    out[i + 2] = Math.round(overBuf[i + 2] * oa + out[i + 2] * (1 - oa)); // R
    out[i + 3] = Math.max(out[i + 3], overBuf[i + 3]); // A
  }

  return nativeImage.createFromBitmap(out, size);
}

/**
 * Map the app's Discord/Stremio states to a status key for the icon.
 * @param {string} discordStatus
 * @returns {'connected'|'connecting'|'disconnected'|'idle'}
 */
function statusForDiscord(discordStatus) {
  switch (discordStatus) {
    case 'Connected':
      return 'connected';
    case 'Connecting...':
      return 'connecting';
    case 'Missing Client ID':
      return 'idle';
    default:
      return 'disconnected';
  }
}

module.exports = {
  getIcon,
  statusForDiscord
};

