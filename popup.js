/**
 * Humble Bundle Downloader — popup controller
 */

const statusEl = document.getElementById('status');
const sessionEl = document.getElementById('session-cookie');
const downloadBtn = document.getElementById('download-now');
const previewBtn = document.getElementById('preview');
const resultsEl = document.getElementById('results');
const formatGroup = document.getElementById('ebook-format-group');

// Cache preview results so Download All doesn't need to re-fetch
let cachedLinks = null;

function setStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.className = isError ? 'status error' : 'status';
  statusEl.style.display = msg ? 'block' : 'none';
}

function setLoading(loading) {
  downloadBtn.disabled = loading;
  previewBtn.disabled = loading;
  downloadBtn.textContent = loading ? 'Working…' : 'Download All';
}

/** Safely escape a string for use inside HTML attribute values or text nodes. */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderLinks(links) {
  if (!links.length) {
    resultsEl.innerHTML = '<p class="empty">No matching files found.</p>';
    return;
  }

  const items = links
    .map(
      (l) =>
        `<li title="${escapeHtml(l.filename)}.${escapeHtml(l.format.toLowerCase())}">
          <span class="name">${escapeHtml(l.filename)}</span>
          <span class="format">${escapeHtml(l.format)}</span>
        </li>`
    )
    .join('');

  resultsEl.innerHTML = `<p class="count">${links.length} file${links.length !== 1 ? 's' : ''} found</p><ul>${items}</ul>`;
}

// Show/hide ebook format selector depending on platform selection
document.getElementById('content-type').addEventListener('change', (e) => {
  formatGroup.style.display = e.target.value === 'ebook' ? 'flex' : 'none';
  cachedLinks = null; // format changed — invalidate cache
});

// Check session on open
chrome.runtime.sendMessage({ action: 'checkSession' }, (res) => {
  if (chrome.runtime.lastError || !res) {
    sessionEl.textContent = '\u2717 Extension error — try reloading';
    sessionEl.className = 'session-status error';
    downloadBtn.disabled = true;
    previewBtn.disabled = true;
    return;
  }
  if (res.loggedIn) {
    sessionEl.textContent = '\u2713 Logged in to Humble Bundle';
    sessionEl.className = 'session-status ok';
  } else {
    sessionEl.textContent = '\u2717 Not logged in — open humblebundle.com first';
    sessionEl.className = 'session-status error';
    downloadBtn.disabled = true;
    previewBtn.disabled = true;
  }
});

// Preview — fetch links and show list without downloading
previewBtn.addEventListener('click', () => {
  const platform = document.getElementById('content-type').value;
  const format =
    platform === 'ebook' ? document.getElementById('ebook-format').value : null;

  setLoading(true);
  setStatus('Fetching library…');
  resultsEl.innerHTML = '';
  cachedLinks = null;

  chrome.runtime.sendMessage({ action: 'fetchLinks', platform, format }, (res) => {
    setLoading(false);
    if (chrome.runtime.lastError || !res) {
      setStatus('Extension error — try reloading the popup.', true);
      return;
    }
    if (res.success) {
      cachedLinks = res.links;
      setStatus(`Scanned ${res.total} order${res.total !== 1 ? 's' : ''}.`);
      renderLinks(res.links);
    } else {
      setStatus(res.error, true);
    }
  });
});

// Download — use cached preview links if available, otherwise re-fetch
downloadBtn.addEventListener('click', () => {
  const platform = document.getElementById('content-type').value;
  const format =
    platform === 'ebook' ? document.getElementById('ebook-format').value : null;

  if (cachedLinks) {
    // Re-use links already fetched during Preview — no extra API call needed
    chrome.runtime.sendMessage(
      { action: 'downloadCached', links: cachedLinks },
      (res) => {
        if (chrome.runtime.lastError || !res) {
          setStatus('Extension error — try reloading the popup.', true);
          return;
        }
        if (res.success) {
          setStatus(`Started ${res.count} download${res.count !== 1 ? 's' : ''}.`);
        } else {
          setStatus(res.error, true);
        }
      }
    );
    return;
  }

  setLoading(true);
  setStatus('Fetching library…');

  chrome.runtime.sendMessage({ action: 'downloadAll', platform, format }, (res) => {
    setLoading(false);
    if (chrome.runtime.lastError || !res) {
      setStatus('Extension error — try reloading the popup.', true);
      return;
    }
    if (res.success) {
      setStatus(`Started ${res.count} download${res.count !== 1 ? 's' : ''}.`);
    } else {
      setStatus(res.error, true);
    }
  });
});
