const statusElement = document.querySelector("#status");
const listElement = document.querySelector("#candidateList");
const scanButton = document.querySelector("#scanButton");
const clearButton = document.querySelector("#clearButton");
const optionsButton = document.querySelector("#optionsButton");

let activeTabId = null;
let candidates = [];
let filter = "all";

function formatBytes(bytes) {
  if (!bytes) return "Size unavailable";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function visibleCandidates() {
  if (filter === "all") return candidates.filter((item) => item.kind !== "playlist");
  return candidates.filter((item) => item.kind === filter);
}

function render() {
  const items = visibleCandidates();
  listElement.innerHTML = "";

  if (!items.length) {
    listElement.innerHTML = `<div class="empty">No matching media yet. Start playback on a page you are authorized to use, then click Scan.</div>`;
    return;
  }

  for (const item of items) {
    const article = document.createElement("article");
    article.className = `candidate ${item.kind}`;
    const canDownload = item.kind !== "playlist";
    article.innerHTML = `
      <div class="meta">
        <strong title="${escapeHtml(item.url)}">${escapeHtml(item.filename)}</strong>
        <span>${escapeHtml(item.kind)} · ${escapeHtml(item.contentType || "media")} · ${formatBytes(item.contentLength)}</span>
      </div>
      <div class="actions">
        <button class="ghost" data-copy="${item.id}" type="button">Copy</button>
        <button data-download="${item.id}" type="button" ${canDownload ? "" : "disabled"}>
          ${canDownload ? "Download" : "Unsupported"}
        </button>
      </div>
    `;
    listElement.appendChild(article);
  }
}

async function loadCandidates(nextCandidates) {
  const tab = await activeTab();
  activeTabId = tab.id;

  if (!tab.url || !/^https?:/.test(tab.url)) {
    statusElement.textContent = "Open a regular website first.";
    candidates = [];
    render();
    return;
  }

  if (nextCandidates) {
    candidates = nextCandidates;
  } else {
    const result = await chrome.runtime.sendMessage({ type: "GET_CANDIDATES", tabId: activeTabId });
    candidates = result?.candidates || [];
  }

  const downloadable = candidates.filter((item) => item.kind !== "playlist").length;
  statusElement.textContent = downloadable
    ? `${downloadable} downloadable file${downloadable === 1 ? "" : "s"} found.`
    : "No direct media file found yet.";
  render();
}

listElement.addEventListener("click", async (event) => {
  const downloadId = event.target.dataset.download;
  const copyId = event.target.dataset.copy;
  const item = candidates.find((candidate) => candidate.id === downloadId || candidate.id === copyId);
  if (!item) return;

  if (copyId) {
    await navigator.clipboard.writeText(item.url);
    statusElement.textContent = "URL copied.";
    return;
  }

  event.target.disabled = true;
  event.target.textContent = "Starting…";
  const result = await chrome.runtime.sendMessage({
    type: "DOWNLOAD_CANDIDATE",
    tabId: activeTabId,
    candidateId: item.id
  });

  if (result?.ok) {
    event.target.textContent = "Started";
    statusElement.textContent = "Chrome is saving the file.";
  } else {
    event.target.disabled = item.kind === "playlist";
    event.target.textContent = item.kind === "playlist" ? "Unsupported" : "Retry";
    statusElement.textContent = result?.error || "Download could not start.";
  }
});

document.querySelectorAll(".filters button").forEach((button) => {
  button.addEventListener("click", () => {
    filter = button.dataset.filter;
    document.querySelectorAll(".filters button").forEach((node) => node.classList.toggle("active", node === button));
    render();
  });
});

scanButton.addEventListener("click", async () => {
  statusElement.textContent = "Scanning this page…";
  const result = await chrome.runtime.sendMessage({ type: "SCAN_PAGE", tabId: activeTabId });
  await loadCandidates(result?.candidates);
  if (result?.error) statusElement.textContent = result.error;
});

clearButton.addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "CLEAR_CANDIDATES", tabId: activeTabId });
  await loadCandidates([]);
});

optionsButton.addEventListener("click", () => chrome.runtime.openOptionsPage());

loadCandidates();
