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
  
  // Remove common torrent/video quality and release tags (case-insensitive).
  // NOTE: order matters — multi-word tags like "web dl" must be stripped before
  // the standalone "web" so we never leave a dangling "web" behind.
  const tags = [
    /\b\d{3,4}p\b/gi,         // 1080p, 720p, etc.
    /\b2160p\b/gi,
    /\bx26[45]\b/gi,          // x264, x265
    /\bh[\s.]?26[45]\b/gi,    // h264, h265, h 265 (after dot-normalization)
    /\bhevc\b/gi,
    /\bavc\b/gi,
    /\bweb[\s-]?dl\b/gi,      // web-dl, web dl, webdl
    /\bweb[\s-]?rip\b/gi,     // web-rip, webrip
    /\bweb\b/gi,              // bare "web" source tag (e.g. ...web HiggsBoson)
    /\bhdtv\b/gi,
    /\bbluray\b/gi,
    /\bblu[\s-]?ray\b/gi,
    /\bbrrip\b/gi,
    /\bbdrip\b/gi,
    /\bdvdrip\b/gi,
    /\bhdr10?\b/gi,
    /\bhdr\b/gi,
    /\bsdr\b/gi,
    /\bdolby\b/gi,
    /\batmos\b/gi,
    /\bmulti\b/gi,
    /\bdual\b/gi,
    /\bdual[\s-]?audio\b/gi,
    /\bsubbed\b/gi,
    /\bdubbed\b/gi,
    /\besub\b/gi,
    /\bdts\b/gi,
    /\bddp?5[\s.]?1\b/gi,     // DDP5.1 / DDP5 1 / DD5.1 (channel layout glued on)
    /\bddp?7[\s.]?1\b/gi,
    /\bddp?5\b/gi,
    /\bddp\b/gi,
    /\bdd\b/gi,
    /\beac3\b/gi,
    /\bac3\b/gi,
    /\baac\b/gi,
    /\b\d\.[01]\b/g,          // audio channel layouts: 5.1, 7.1, 2.0 (any X.Y)
    /\b10bit\b/gi,
    /\b8bit\b/gi,
    /\bdv\b/gi,
    /\bamzn\b/gi,
    /\bnf\b/gi,                // Netflix source tag
    /\bdsnp\b/gi,             // Disney+ source tag
    /\bhmax\b/gi,             // HBO Max source tag
    /\bhulu\b/gi,             // Hulu source tag
    /\batvp\b/gi,             // Apple TV+ source tag
    /\bpcok\b/gi,             // Peacock source tag
    /\bpmtp\b/gi,             // Paramount+ source tag
    /\bime\b/gi,
    /\bhiggsboson\b/gi,
    /\bmegusta\b/gi,
    /\bwww\b/gi,
    /\buindex\b/gi,
    /\borg\b/gi,
    /\byify\b/gi,
    /\byts\b/gi,
    /\brarbg\b/gi,
    /\bremastered\b/gi,
    /\bproper\b/gi,
    /\brepack\b/gi,
    /\bextended\b/gi,
    /\bunrated\b/gi,
    /\bt3nzin\b/gi,
    /\bgalaxytv\b/gi,
    /\btgx\b/gi
  ];

  tags.forEach(tag => {
    cleaned = cleaned.replace(tag, '');
  });
  
  // Remove empty parentheses/brackets that might result from tag removals
  cleaned = cleaned.replace(/\(\s*\)/g, '');
  cleaned = cleaned.replace(/\[\s*\]/g, '');

  // Strip a trailing release-group token such as "-RARBG", "-NTb", "-ETTV",
  // "-FLUX" left after quality/codec tags were removed. Only strip when it
  // clearly looks like a scene group (ALL-CAPS, or a short mixed-case token
  // with at least one capital) so legitimate hyphenated titles like
  // "Spider-Man" are preserved.
  cleaned = cleaned.replace(/\s+-\s*([A-Za-z0-9]{2,})\s*$/, (m, grp) => {
    const isAllCaps = grp === grp.toUpperCase() && /[A-Z]/.test(grp);
    const isShortMixed = grp.length <= 6 && /[A-Z]/.test(grp) && /[a-z]/.test(grp);
    return (isAllCaps || isShortMixed) ? ' ' : m;
  });

  // Drop dangling stray separators and orphan single characters left behind
  // (e.g. a lone "(" from a "(1x3)" marker, or a leftover hyphen).
  cleaned = cleaned.replace(/[([{<]+\s*$/g, '');
  cleaned = cleaned.replace(/^\s*[)\]}>]+/g, '');

  // A trailing lone digit is almost always an audio-channel leftover (e.g.
  // "DDP5 1" -> "1"); titles don't end in a bare single digit.
  cleaned = cleaned.replace(/\s+\d\s*$/g, '');

  // Clean up multiple spaces and clean trim
  cleaned = cleaned.replace(/\s+/g, ' ');
  cleaned = cleaned.trim();

  // If the title starts or ends with a dash, clean it up
  cleaned = cleaned.replace(/^[-–·]\s*|\s*[-–·]\s*$/g, '');
  cleaned = cleaned.trim();

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
 * Validate a candidate episode title extracted from a filename. Release files
 * often leave junk after the SxxExx marker (group names, language codes, stray
 * source tags like "web HiggsBoson"), which must NOT be shown as an episode
 * title. Returns the title only if it looks like a real, human-readable name.
 * @param {string|null} s
 * @returns {string|null}
 */
function sanitizeEpisodeTitle(s) {
  if (!s) return null;
  let t = s.trim();
  if (t.length < 2) return null;

  // Must contain at least one letter (reject pure numbers/symbols).
  if (!/[a-zA-Z]/.test(t)) return null;

  // Reject if it's a single lowercase "word" with no spaces — that's almost
  // always a leftover release-group/source tag (e.g. "higgsboson", "ettv"),
  // never a real episode title (real titles are Title-Cased words).
  if (!/\s/.test(t) && t === t.toLowerCase()) return null;

  // Reject ALL-CAPS single tokens (group tags like "RARBG", "ETTV").
  if (!/\s/.test(t) && t === t.toUpperCase() && t.length <= 8) return null;

  return t;
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
    let episodeTitle = sanitizeEpisodeTitle(stripYear(cleanTitle(afterPart)));

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
 * Rough measure of how actively a torrent file is being cached/read, used to
 * disambiguate multiple cached files within a season-pack torrent.
 * @param {object} file
 * @returns {number}
 */
function cacheActivityScore(file) {
  if (!file) return 0;
  const ev = file.__cacheEvents;
  if (Array.isArray(ev)) return ev.length;
  if (ev && typeof ev === 'object') return Object.keys(ev).length;
  if (typeof file.length === 'number') return file.length; // tiebreak by size
  return ev ? 1 : 0;
}

const VIDEO_EXT_RE = /\.(mkv|mp4|avi|mov|m4v|webm|ts|flv|wmv|mpg|mpeg)$/i;

/**
 * Choose the largest video file from a torrent's file list. For single-file
 * torrents this returns that file; for season packs it errs toward the biggest
 * episode, which is a safer default than files[0] when no active file is known.
 * @param {Array} files
 * @returns {object|null}
 */
function pickLargestVideoFile(files) {
  if (!Array.isArray(files) || files.length === 0) return null;
  const videos = files.filter(f => f && f.name && VIDEO_EXT_RE.test(f.name));
  const pool = videos.length ? videos : files;
  return pool.reduce((best, f) => {
    const size = (f && typeof f.length === 'number') ? f.length : 0;
    const bestSize = (best && typeof best.length === 'number') ? best.length : 0;
    return size > bestSize ? f : best;
  }, pool[0]);
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

          // Sort torrents to identify the currently active stream. The single
          // most reliable signal that a torrent is the one being PLAYED (not
          // just an old one lingering in cache) is active streaming progress:
          // Stremio reports `streamProgress` / `streamLen` only for the file the
          // player is actually reading. We rank on that first, then fall back to
          // download/peer activity for torrents that haven't started streaming.
          // 1. Active streaming (streamProgress set / streamLen > 0)
          // 2. Active download queue (queued pieces > 0)
          // 3. Count of unique peers encountered (unique)
          // 4. Active connection count (swarmConnections)
          // 5. Latest tracker start time
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
            // `streaming` is truthy when this torrent is the one being read by
            // the player right now. streamLen/streamProgress are only present on
            // the active stream.
            const isStreaming =
              !!torrent.streaming ||
              (typeof torrent.streamLen === 'number' && torrent.streamLen > 0) ||
              (typeof torrent.streamProgress === 'number' && torrent.streamProgress > 0);

            return {
              key,
              torrent,
              isStreaming: isStreaming ? 1 : 0,
              queued: torrent.queued || 0,
              unique: torrent.unique || 0,
              swarmConnections: torrent.swarmConnections || 0,
              latestStart
            };
          });

          // Sort descending using our priority layers
          torrentsWithMetrics.sort((a, b) => {
            if (b.isStreaming !== a.isStreaming) {
              return b.isStreaming - a.isStreaming;
            }
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

          // Within the chosen torrent (which may be a season pack with multiple
          // episode files), pick the file actually being streamed. Stremio marks
          // it via `__cacheEvents`/active selections; we prefer, in order:
          //   1. the file with the largest active cache window (currently read)
          //   2. any file flagged with __cacheEvents
          //   3. the largest video file (best guess for a single-file torrent)
          let activeFile = null;
          if (Array.isArray(activeTorrent.files) && activeTorrent.files.length) {
            const files = activeTorrent.files;

            // Files Stremio is actively caching/reading carry __cacheEvents.
            const cached = files.filter(f => f && f.__cacheEvents);
            if (cached.length === 1) {
              activeFile = cached[0];
            } else if (cached.length > 1) {
              // Multiple cached files: choose the one with the most cache
              // activity (the one the player is reading right now).
              activeFile = cached.reduce((best, f) => {
                const score = cacheActivityScore(f);
                return score > cacheActivityScore(best) ? f : best;
              }, cached[0]);
            } else {
              // Nothing flagged yet (just opened): fall back to the largest
              // video file rather than blindly taking files[0], which is often
              // the first episode of a season pack.
              activeFile = pickLargestVideoFile(files);
            }
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
