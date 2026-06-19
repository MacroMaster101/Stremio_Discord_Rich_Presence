/**
 * src/stremioDetector.js
 * Detects whether the Stremio Desktop application process is currently running on the PC.
 */

const { exec } = require('child_process');
const http = require('http');

/**
 * Checks if the Stremio process is currently running.
 * Uses 'tasklist' on Windows and 'pgrep' on macOS/Linux as a fallback.
 * 
 * @returns {Promise<boolean>} Resolves to true if running, false otherwise.
 */
function checkIfStremioRunning() {
  return new Promise((resolve) => {
    const isWindows = process.platform === 'win32';
    
    const command = isWindows
      ? 'tasklist /NH'
      : 'pgrep -x "stremio" || pgrep -x "Stremio" || pgrep -x "stremio-runtime"';

    exec(command, (error, stdout, stderr) => {
      // If error occurs on macOS/Linux, it could be that the process wasn't found (pgrep returns exit code 1)
      if (error && !isWindows) {
        return resolve(false);
      }

      const output = (stdout || '').trim().toLowerCase();

      if (isWindows) {
        // Check for either the new UI shell (stremio-shell-ng.exe) or the older executable name (stremio.exe)
        const isRunning = output.includes('stremio-shell-ng.exe') || 
                          output.includes('stremio.exe');
        resolve(isRunning);
      } else {
        // On macOS/Linux, if pgrep returned output, it's running
        resolve(output.length > 0);
      }
    });
  });
}

/**
 * Clean up raw torrent/file names by removing video qualities, codecs, release tags, and extensions.
 * @param {string} title - The raw torrent or file name.
 * @returns {string|null} Cleaned title or null.
 */
function cleanTitle(title) {
  if (!title) return null;
  
  // Remove file extension
  let cleaned = title.replace(/\.[a-zA-Z0-9]{2,4}$/, '');
  
  // Replace dots, hyphens, and underscores with spaces
  cleaned = cleaned.replace(/[\._]/g, ' ');
  
  // Remove common torrent/video quality and release tags (case-insensitive)
  const tags = [
    /\b\d{3,4}p\b/gi,         // 1080p, 720p, etc.
    /\bx26[45]\b/gi,          // x264, x265
    /\bh\.?26[45]\b/gi,       // h264, h265
    /\bhevc\b/gi,
    /\bweb-?dl\b/gi,
    /\bwebrip\b/gi,
    /\bbluray\b/gi,
    /\bhdr\b/gi,
    /\bmulti\b/gi,
    /\bdts\b/gi,
    /\beac3\b/gi,
    /\b5\.1\b/g,
    /\b10bit\b/gi,
    /\bImE\b/g,
    /\bHiggsBoson\b/g,
    /\bMeGusta\b/gi,
    /\bAMZN\b/gi,
    /\bwww\b/gi,
    /\bUIndex\b/gi,
    /\borg\b/gi,
    /\bYIFY\b/gi,
    /\bYTS\b/gi,
    /\bRARBG\b/gi,
    /\bREMASTERED\b/gi,
    /\bPROPER\b/gi,
    /\bREPACK\b/gi,
    /\bEXTENDED\b/gi,
    /\bUNRATED\b/gi,
    /\bDDP?5\b/gi,
    /\bAAC\b/gi,
    /\bDV\b/gi,
    /\b2160p\b/gi,
    /\bt3nzin\b/gi,
    /\bGalaxyTV\b/gi,
    /\bTGx\b/gi
  ];
  
  tags.forEach(tag => {
    cleaned = cleaned.replace(tag, '');
  });
  
  // Remove empty parentheses/brackets that might result from tag removals
  cleaned = cleaned.replace(/\(\s*\)/g, '');
  cleaned = cleaned.replace(/\[\s*\]/g, '');
  
  // Clean up multiple spaces and clean trim
  cleaned = cleaned.replace(/\s+/g, ' ');
  cleaned = cleaned.trim();
  
  // If the title starts or ends with a dash, clean it up
  cleaned = cleaned.replace(/^-\s*|\s*-\s*$/g, '');

  return cleaned || null;
}

/**
 * Remove a standalone 4-digit year (and any now-empty brackets/dashes) from a
 * cleaned name. Used so "From (2022)" becomes "From" and the year is re-added
 * in a controlled, single place.
 * @param {string|null} s
 * @returns {string|null}
 */
function stripYear(s) {
  if (!s) return s;
  let out = s.replace(/\(?\b(19|20)\d{2}\b\)?/g, ' ');
  out = out.replace(/\(\s*\)/g, '').replace(/\[\s*\]/g, '');
  out = out.replace(/\s+/g, ' ').trim();
  out = out.replace(/^[-–·\s]+|[-–·\s]+$/g, '').trim();
  return out || null;
}

/**
 * Parse a raw torrent/file name into structured media info.
 * Detects series (SxxExx) vs movie, and extracts show/movie name, year,
 * season/episode numbers, and an episode title when present.
 *
 * @param {string} rawName - The raw torrent or file name.
 * @returns {object|null} Structured info, or null if unparseable.
 *   {
 *     type: 'series' | 'movie',
 *     name: string,           // show or movie name (cleaned)
 *     year: string|null,      // 4-digit year if found
 *     season: number|null,
 *     episode: number|null,
 *     episodeTitle: string|null,
 *     searchName: string,     // best query string for metadata lookups
 *     display: string         // human-readable single-line title
 *   }
 */
function parseMediaInfo(rawName) {
  if (!rawName) return null;

  // Strip file extension and normalize separators to spaces (but keep the
  // original for SxxExx detection which we run on a space-normalized copy).
  let base = rawName.replace(/\.[a-zA-Z0-9]{2,4}$/, '');
  base = base.replace(/[\._]/g, ' ');

  // Extract a year (first standalone 19xx/20xx).
  const yearMatch = base.match(/\b(19|20)\d{2}\b/);
  const year = yearMatch ? yearMatch[0] : null;

  // Detect SxxExx (also Sxx Exx, 1x09 forms).
  const seMatch =
    base.match(/\bS(\d{1,2})\s*E(\d{1,3})\b/i) ||
    base.match(/\b(\d{1,2})x(\d{1,3})\b/);

  if (seMatch) {
    const season = parseInt(seMatch[1], 10);
    const episode = parseInt(seMatch[2], 10);

    // Show name: everything before the SxxExx marker.
    const beforeIdx = base.search(/\bS\d{1,2}\s*E\d{1,3}\b|\b\d{1,2}x\d{1,3}\b/i);
    let showPart = beforeIdx > 0 ? base.slice(0, beforeIdx) : base;
    // Episode title: text right after the SxxExx marker, before quality tags.
    let afterPart = beforeIdx >= 0 ? base.slice(beforeIdx + seMatch[0].length) : '';

    const name = stripYear(cleanTitle(showPart)) || cleanTitle(base) || 'Unknown';
    let episodeTitle = stripYear(cleanTitle(afterPart));
    // Drop episode title if it's empty or just leftover tags.
    if (episodeTitle && episodeTitle.length < 2) episodeTitle = null;

    const sStr = String(season).padStart(2, '0');
    const eStr = String(episode).padStart(2, '0');
    const epLabel = `S${sStr}E${eStr}`;
    const display = episodeTitle
      ? `${name} · ${epLabel} – ${episodeTitle}`
      : `${name} · ${epLabel}`;

    return {
      type: 'series',
      name,
      year,
      season,
      episode,
      episodeTitle,
      searchName: name,
      display
    };
  }

  // Movie: cleaned name with the year stripped out (we re-add it formatted).
  const name = stripYear(cleanTitle(base)) || 'Unknown';
  const display = year ? `${name} (${year})` : name;
  return {
    type: 'movie',
    name,
    year,
    season: null,
    episode: null,
    episodeTitle: null,
    searchName: name,
    display
  };
}

/**
 * Queries the Stremio local streaming server (port 11470) for the currently
 * active media and returns structured info (see parseMediaInfo), or null.
 * @returns {Promise<object|null>}
 */
function fetchActiveMedia() {
  return new Promise((resolve) => {
    const options = {
      hostname: '127.0.0.1',
      port: 11470,
      path: '/stats.json',
      method: 'GET',
      timeout: 1000
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          if (res.statusCode !== 200) {
            return resolve(null);
          }
          const stats = JSON.parse(data);
          const keys = Object.keys(stats);
          if (keys.length === 0) {
            return resolve(null);
          }

          // Sort torrents to identify the currently active stream:
          // 1. Prioritize active download queue (queued pieces > 0)
          // 2. Prioritize count of unique peers encountered (unique)
          // 3. Prioritize active connection count (swarmConnections)
          // 4. Fallback to the latest tracker start time
          const torrentsWithMetrics = keys.map(key => {
            const torrent = stats[key];
            let latestStart = 0;
            if (torrent.sources) {
              torrent.sources.forEach(src => {
                if (src.lastStarted) {
                  const t = new Date(src.lastStarted).getTime();
                  if (t > latestStart) {
                    latestStart = t;
                  }
                }
              });
            }
            return {
              key,
              torrent,
              queued: torrent.queued || 0,
              unique: torrent.unique || 0,
              swarmConnections: torrent.swarmConnections || 0,
              latestStart
            };
          });

          // Sort descending using our priority layers
          torrentsWithMetrics.sort((a, b) => {
            if (b.queued !== a.queued) {
              return b.queued - a.queued;
            }
            if (b.unique !== a.unique) {
              return b.unique - a.unique;
            }
            if (b.swarmConnections !== a.swarmConnections) {
              return b.swarmConnections - a.swarmConnections;
            }
            return b.latestStart - a.latestStart;
          });

          const activeTorrent = torrentsWithMetrics[0] ? torrentsWithMetrics[0].torrent : null;
          if (!activeTorrent) {
            return resolve(null);
          }

          // Prioritize the file currently being cached/streamed
          let activeFile = null;
          if (activeTorrent.files) {
            activeFile = activeTorrent.files.find(f => f.__cacheEvents);
          }

          const rawTitle = activeFile ? activeFile.name : activeTorrent.name;
          resolve(parseMediaInfo(rawTitle));
        } catch (e) {
          resolve(null);
        }
      });
    });

    req.on('error', () => resolve(null));
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
    req.end();
  });
}

/**
 * Queries the Stremio local server for the currently playing media and returns
 * structured info (see parseMediaInfo). Returns null when nothing is detected.
 * @returns {Promise<object|null>}
 */
function getPlayingMedia() {
  return fetchActiveMedia();
}

/**
 * Backward-compatible helper: returns just the display title string, or null.
 * @returns {Promise<string|null>}
 */
async function getPlayingTitle() {
  const media = await fetchActiveMedia();
  return media ? media.display : null;
}

module.exports = {
  checkIfStremioRunning,
  getPlayingTitle,
  getPlayingMedia,
  parseMediaInfo
};
