/**
 * Humble Bundle Downloader — popup controller
 */

const statusEl   = document.getElementById('status');
const sessionEl  = document.getElementById('session-cookie');
const downloadBtn = document.getElementById('download-now');
const previewBtn  = document.getElementById('preview');
const resultsEl   = document.getElementById('results');
const formatGroup = document.getElementById('ebook-format-group');

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

function renderLinks(links) {
  if (!links.length) { resultsEl.innerHTML = '<p class="empty">No matching files found.</p>'; return; }
  const items = links.map((l) =>
    `<li title="${l.filename}.${l.format.toLowerCase()}"><span class="name">${l.filename}</span><span class="format">${l.format}</span></li>`
  ).join('');
  resultsEl.innerHTML = `<p class="count">${links.length} file${links.length !== 1 ? 's' : ''} found</p><ul>${items}</ul>`;
}

document.getElementById('content-type').addEventListener('change', (e) => {
  formatGroup.style.display = e.target.value === 'ebook' ? 'flex' : 'none';
});

chrome.runtime.sendMessage({ action: 'checkSession' }, ({ loggedIn }) => {
  if (loggedIn) {
    sessionEl.textContent = '✓ Logged in to Humble Bundle';
    sessionEl.className = 'session-status ok';
  } else {
    sessionEl.textContent = '✗ Not logged in — open humblebundle.com first';
    sessionEl.className = 'session-status error';
    downloadBtn.disabled = true;
    previewBtn.disabled = true;
  }
});

previewBtn.addEventListener('click', () => {
  const platform = document.getElementById('content-type').value;
  const format = platform === 'ebook' ? document.getElementById('ebook-format').value : null;
  setLoading(true);
  setStatus('Fetching library…');
  resultsEl.innerHTML = '';
  chrome.runtime.sendMessage({ action: 'fetchLinks', platform, format }, (res) => {
    setLoading(false);
    if (res.success) { setStatus(`Scanned ${res.total} order${res.total !== 1 ? 's' : ''}.`); renderLinks(res.links); }
    else setStatus(res.error, true);
  });
});

downloadBtn.addEventListener('click', () => {
  const platform = document.getElementById('content-type').value;
  const format = platform === 'ebook' ? document.getElementById('ebook-format').value : null;
  setLoading(true);
  setStatus('Fetching library…');
  chrome.runtime.sendMessage({ action: 'downloadAll', platform, format }, (res) => {
    setLoading(false);
    if (res.success) setStatus(`Started ${res.count} download${res.count !== 1 ? 's' : ''}.`);
    else setStatus(res.error, true);
  });
});
