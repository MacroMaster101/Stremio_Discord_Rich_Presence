/**
 * src/cinemeta.js
 * Optional poster artwork lookups via Cinemeta — Stremio's own public metadata
 * addon (the same source the Stremio app uses). No API key required.
 *
 * Privacy: when enabled, this sends the media's title (and type) to Stremio's
 * Cinemeta addon to fetch a poster image URL. It sends nothing else. It is
 * controlled by a tray toggle. On any error it resolves null and the app falls
 * back to the generic Stremio logo.
 */

const https = require('https');

const HOST = 'v3-cinemeta.strem.io';

// Small in-memory cache so we don't re-query for the same title repeatedly.
const cache = new Map();

/**
 * Cinemeta needs no key, so the poster feature is always available.
 * @returns {boolean}
 */
function isAvailable() {
  return true;
}

/**
 * GET a Cinemeta JSON endpoint and resolve the parsed body (or null on error).
 * @param {string} pathWithQuery
 * @returns {Promise<object|null>}
 */
function cinemetaGet(pathWithQuery) {
  return new Promise((resolve) => {
    const options = {
      hostname: HOST,
      path: pathWithQuery,
      method: 'GET',
      timeout: 4000,
      headers: { Accept: 'application/json' }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        if (res.statusCode !== 200) return resolve(null);
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.end();
  });
}

/**
 * Pick the best match from a Cinemeta search result, preferring an exact
 * (case-insensitive) name match and, when available, a matching year.
 * @param {Array} metas
 * @param {object} media
 * @returns {object|null}
 */
function pickBest(metas, media) {
  if (!Array.isArray(metas) || metas.length === 0) return null;
  const wanted = (media.searchName || media.name || '').trim().toLowerCase();

  const exact = metas.filter((m) => (m.name || '').trim().toLowerCase() === wanted);
  const pool = exact.length ? exact : metas;

  if (media.year) {
    const byYear = pool.find((m) => String(m.releaseInfo || m.year || '').includes(String(media.year)));
    if (byYear) return byYear;
  }
  return pool[0];
}

/**
 * Look up a poster image URL for the given parsed media info via Cinemeta.
 * Returns null if nothing matches or on any error.
 *
 * @param {object} media - Output of parseMediaInfo (needs searchName, type, year).
 * @returns {Promise<string|null>} Poster image URL, or null.
 */
async function getPosterUrl(media) {
  if (!media) return null;

  const query = (media.searchName || media.name || '').trim();
  if (!query) return null;

  const cacheKey = `${media.type}|${query}|${media.year || ''}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const catalog = media.type === 'series' ? 'series' : 'movie';
  const path = `/catalog/${catalog}/top/search=${encodeURIComponent(query)}.json`;

  let result = await cinemetaGet(path);
  let best = result && pickBest(result.metas, media);

  // If a series search found nothing, try the movie catalog as a fallback
  // (and vice versa), since filename type detection isn't always perfect.
  if (!best) {
    const altCatalog = catalog === 'series' ? 'movie' : 'series';
    const altPath = `/catalog/${altCatalog}/top/search=${encodeURIComponent(query)}.json`;
    result = await cinemetaGet(altPath);
    best = result && pickBest(result.metas, media);
  }

  const url = best && best.poster ? best.poster : null;
  cache.set(cacheKey, url);
  return url;
}

module.exports = {
  isAvailable,
  getPosterUrl
};
