/**
 * Humble Bundle Downloader — background service worker (MV3)
 *
 * Uses the Humble Bundle internal API (authenticated via browser session cookies)
 * to fetch all orders and extract download links for ebooks, audio, video, and software.
 *
 * API endpoints:
 *   GET /api/v1/user/order?ajax=true          → list of { gamekey }
 *   GET /api/v1/orders?all_tpkds=true&gamekeys=<k1>&gamekeys=<k2>…
 *       → map of gamekey → { subproducts: [ { machine_name, downloads: [ { platform, download_struct } ] } ] }
 */

const HB_BASE = 'https://www.humblebundle.com';
const BATCH_SIZE = 40; // API supports up to 40 gamekeys per request

// ─── Humble Bundle API ────────────────────────────────────────────────────────

/**
 * Fetches all order gamekeys for the authenticated user.
 * @returns {Promise<string[]>}
 */
async function fetchGameKeys() {
  const res = await fetch(`${HB_BASE}/api/v1/user/order?ajax=true`, {
    credentials: 'include',
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch orders (${res.status}). Are you logged in to Humble Bundle?`);
  }

  const data = await res.json();
  return data.map((entry) => entry.gamekey);
}

/**
 * Fetches full order contents for up to BATCH_SIZE gamekeys at a time.
 * @param {string[]} gameKeys
 * @returns {Promise<Object>} gamekey → order contents
 */
async function fetchOrderContents(gameKeys) {
  const results = {};

  for (let i = 0; i < gameKeys.length; i += BATCH_SIZE) {
    const batch = gameKeys.slice(i, i + BATCH_SIZE);
    const query = batch.map((k) => `gamekeys=${encodeURIComponent(k)}`).join('&');
    const res = await fetch(`${HB_BASE}/api/v1/orders?all_tpkds=true&${query}`, {
      credentials: 'include',
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch order contents (${res.status})`);
    }

    const batchData = await res.json();
    Object.assign(results, batchData);
  }

  return results;
}

/**
 * Extracts download links from order contents filtered by platform and format.
 * @param {Object} orderContents
 * @param {string} platform  e.g. 'ebook', 'audio', 'video', 'software'
 * @param {string|null} format  e.g. 'PDF', 'EPUB', 'MOBI' — null returns all formats
 * @returns {{ filename: string, format: string, url: string }[]}
 */
function extractDownloadLinks(orderContents, platform, format) {
  const links = [];

  for (const gameKey of Object.keys(orderContents)) {
    const subproducts = orderContents[gameKey]?.subproducts ?? [];

    for (const product of subproducts) {
      const platformDownloads = (product.downloads ?? []).filter(
        (d) => d.platform === platform
      );

      for (const download of platformDownloads) {
        for (const struct of download.download_struct ?? []) {
          const structFormat = struct.name ?? 'unknown';
          if (format && structFormat.toUpperCase() !== format.toUpperCase()) continue;

          const url = struct.url?.web;
          if (!url) continue;

          links.push({
            filename: product.machine_name,
            format: structFormat,
            url,
          });
        }
      }
    }
  }

  return links;
}

// ─── Session check ────────────────────────────────────────────────────────────

/**
 * Returns true if the user appears to be logged in to Humble Bundle.
 * @returns {Promise<boolean>}
 */
async function isLoggedIn() {
  return new Promise((resolve) => {
    chrome.cookies.get(
      { url: HB_BASE, name: '_simpleauth_sess' },
      (cookie) => resolve(Boolean(cookie?.value))
    );
  });
}

// ─── Downloads ────────────────────────────────────────────────────────────────

/**
 * Triggers browser downloads for all provided links.
 * @param {{ filename: string, format: string, url: string }[]} links
 */
function triggerDownloads(links) {
  for (const link of links) {
    const ext = link.format.toLowerCase().replace(/[^a-z0-9]/g, '');
    chrome.downloads.download({
      url: link.url,
      filename: `humble-bundle/${link.filename}.${ext}`,
    });
  }
}

// ─── Message handler ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === 'checkSession') {
    isLoggedIn().then((loggedIn) => sendResponse({ loggedIn }));
    return true;
  }

  if (request.action === 'fetchLinks') {
    const { platform, format } = request;

    (async () => {
      try {
        const gameKeys = await fetchGameKeys();
        const orderContents = await fetchOrderContents(gameKeys);
        const links = extractDownloadLinks(orderContents, platform, format || null);
        sendResponse({ success: true, links, total: gameKeys.length });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();

    return true; // keep message channel open for async response
  }

  if (request.action === 'downloadCached') {
    const { links } = request;
    if (!Array.isArray(links) || links.length === 0) {
      sendResponse({ success: false, error: 'No matching downloads found.' });
      return true;
    }
    triggerDownloads(links);
    sendResponse({ success: true, count: links.length });
    return true;
  }

  if (request.action === 'downloadAll') {
    const { platform, format } = request;

    (async () => {
      try {
        const gameKeys = await fetchGameKeys();
        const orderContents = await fetchOrderContents(gameKeys);
        const links = extractDownloadLinks(orderContents, platform, format || null);

        if (links.length === 0) {
          sendResponse({ success: false, error: 'No matching downloads found.' });
          return;
        }

        triggerDownloads(links);
        sendResponse({ success: true, count: links.length });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();

    return true;
  }
});
