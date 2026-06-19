/**
 * src/trayIcon.js
 * Builds dynamic tray icons by compositing a small colored status dot onto the
 * base tray icon. Keeps a single source image (assets/tray-icon.png) and derives the
 * connected / connecting / disconnected variants at runtime — no extra files.
 */

const path = require('path');
const zlib = require('zlib');
const { nativeImage, nativeTheme } = require('electron');

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
 * Generate an RGBA PNG buffer containing the status dot with a contrasting
 * outline, over a transparent background. The outline color is chosen to
 * contrast with the current taskbar (dark vs light) so the status reads on any
 * background — the dot's own color never has to fight the taskbar.
 * @param {[number,number,number]} rgb - The dot fill color.
 * @param {[number,number,number]} ring - The outline color.
 * @returns {Buffer} PNG file bytes.
 */
function makeDotPng(rgb, ring) {
  const size = ICON_SIZE;
  const bytesPerPixel = 4;
  const stride = size * bytesPerPixel;
  // Raw image: one extra filter byte (0) per scanline.
  const raw = Buffer.alloc((stride + 1) * size, 0);

  // A 1.5px ring sits just outside the fill radius for legibility on any bg.
  const ringWidth = 1.5;
  const outerRadius = DOT_RADIUS + ringWidth;

  for (let y = 0; y < size; y++) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0; // filter type "none"
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - DOT_CENTER_X;
      const dy = y + 0.5 - DOT_CENTER_Y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Anti-aliased coverage for the outer (ring) edge and inner (fill) edge.
      const outerCov = Math.max(0, Math.min(1, outerRadius - dist + 0.5));
      if (outerCov <= 0) continue;
      const fillCov = Math.max(0, Math.min(1, DOT_RADIUS - dist + 0.5));

      // Blend fill over ring: fill where inside, ring in the annulus.
      const r = Math.round(rgb[0] * fillCov + ring[0] * (1 - fillCov));
      const g = Math.round(rgb[1] * fillCov + ring[1] * (1 - fillCov));
      const b = Math.round(rgb[2] * fillCov + ring[2] * (1 - fillCov));

      const px = rowStart + 1 + x * bytesPerPixel;
      raw[px] = r;
      raw[px + 1] = g;
      raw[px + 2] = b;
      raw[px + 3] = Math.round(outerCov * 255);
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
 * Whether the OS is currently using a dark theme (dark taskbar). Falls back to
 * dark, which is the most common Windows taskbar.
 * @returns {boolean}
 */
function isDarkTheme() {
  try {
    return nativeTheme.shouldUseDarkColors;
  } catch (e) {
    return true;
  }
}

// Invalidate the variant cache whenever the system theme flips, so the ring
// re-renders for the new taskbar color on the next getIcon() call.
try {
  nativeTheme.on('updated', () => variantCache.clear());
} catch (e) {
  // nativeTheme events are best-effort; safe to ignore if unavailable.
}

/**
 * Build (and cache) a tray icon for the given status, compositing the colored
 * status dot — with a theme-contrasting outline — onto the base icon.
 *
 * @param {'connected'|'connecting'|'disconnected'|'idle'} status
 * @returns {Electron.NativeImage}
 */
function getIcon(status) {
  const status_ = COLORS[status] ? status : 'idle';
  const dark = isDarkTheme();
  // Cache per status *and* theme — a light taskbar needs a different ring.
  const key = `${status_}:${dark ? 'dark' : 'light'}`;
  if (variantCache.has(key)) return variantCache.get(key);

  // On a dark taskbar, ring the dot in light; on a light taskbar, ring in dark.
  const ring = dark ? [245, 246, 248] : [24, 25, 28];

  const base = getBaseIcon();
  let composed;
  try {
    const dot = nativeImage.createFromBuffer(makeDotPng(COLORS[status_], ring));
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

