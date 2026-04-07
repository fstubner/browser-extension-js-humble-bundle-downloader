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
const BATCH_SIZE = 40;

async function fetchGameKeys() {
  const res = await fetch(`${HB_BASE}/api/v1/user/order?ajax=true`, { credentials: 'include' });
  if (!res.ok) throw new Error(`Failed to fetch orders (${res.status}). Are you logged in to Humble Bundle?`);
  const data = await res.json();
  return data.map((entry) => entry.gamekey);
}

async function fetchOrderContents(gameKeys) {
  const results = {};
  for (let i = 0; i < gameKeys.length; i += BATCH_SIZE) {
    const batch = gameKeys.slice(i, i + BATCH_SIZE);
    const query = batch.map((k) => `gamekeys=${encodeURIComponent(k)}`).join('&');
    const res = await fetch(`${HB_BASE}/api/v1/orders?all_tpkds=true&${query}`, { credentials: 'include' });
    if (!res.ok) throw new Error(`Failed to fetch order contents (${res.status})`);
    Object.assign(results, await res.json());
  }
  return results;
}

function extractDownloadLinks(orderContents, platform, format) {
  const links = [];
  for (const gameKey of Object.keys(orderContents)) {
    for (const product of (orderContents[gameKey]?.subproducts ?? [])) {
      for (const download of (product.downloads ?? []).filter((d) => d.platform === platform)) {
        for (const struct of (download.download_struct ?? [])) {
          const structFormat = struct.name ?? 'unknown';
          if (format && structFormat.toUpperCase() !== format.toUpperCase()) continue;
          const url = struct.url?.web;
          if (!url) continue;
          links.push({ filename: product.machine_name, format: structFormat, url });
        }
      }
    }
  }
  return links;
}

async function isLoggedIn() {
  return new Promise((resolve) => {
    chrome.cookies.get({ url: HB_BASE, name: '_simpleauth_sess' }, (cookie) => resolve(Boolean(cookie?.value)));
  });
}

function triggerDownloads(links) {
  for (const link of links) {
    const ext = link.format.toLowerCase().replace(/[^a-z0-9]/g, '');
    chrome.downloads.download({ url: link.url, filename: `humble-bundle/${link.filename}.${ext}` });
  }
}

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
    return true;
  }

  if (request.action === 'downloadAll') {
    const { platform, format } = request;
    (async () => {
      try {
        const gameKeys = await fetchGameKeys();
        const orderContents = await fetchOrderContents(gameKeys);
        const links = extractDownloadLinks(orderContents, platform, format || null);
        if (links.length === 0) { sendResponse({ success: false, error: 'No matching downloads found.' }); return; }
        triggerDownloads(links);
        sendResponse({ success: true, count: links.length });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }
});
