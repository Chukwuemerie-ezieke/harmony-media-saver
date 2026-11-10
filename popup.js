const { escapeHtml, formatBytes, largeFileLimit } = globalThis.HarmonyShared;
const { resolveLanguage, translator, applyTranslations } = globalThis.HarmonyI18n;

const statusElement = document.querySelector("#status");
const listElement = document.querySelector("#candidateList");
const scanButton = document.querySelector("#scanButton");
const clearButton = document.querySelector("#clearButton");
const optionsButton = document.querySelector("#optionsButton");
const batchBar = document.querySelector("#batchBar");
const selectAllBox = document.querySelector("#selectAll");
const downloadSelectedButton = document.querySelector("#downloadSelected");

const DOWNLOADS_KEY = "downloadsByCandidate";

let t = translator("en");
let settings = {};
let activeTabId = null;
let candidates = [];
let filter = "all";
const selected = new Set();

// candidate id -> Chrome download id, and the latest state of each download.
let downloadIds = {};
const downloadState = new Map();
let pollTimer = 0;

// Large-file confirmation: the first click asks, the second click downloads.
let confirmItemId = null;
let confirmBatch = false;

function sizeLabel(bytes) {
  return formatBytes(bytes) || t("sizeUnavailable");
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function visibleCandidates() {
  if (filter === "all") return candidates.filter((item) => item.kind !== "playlist");
  return candidates.filter((item) => item.kind === filter);
}

function downloadable(items) {
  return items.filter((item) => item.kind !== "playlist");
}

function isLarge(bytes) {
  const limit = largeFileLimit(settings);
  return Boolean(limit && bytes > limit);
}

function selectedItems() {
  return candidates.filter((item) => selected.has(item.id));
}

function updateBatchBar() {
  const items = downloadable(visibleCandidates());
  const visibleIds = new Set(items.map((item) => item.id));
  for (const id of selected) if (!visibleIds.has(id)) selected.delete(id);

  batchBar.hidden = items.length < 2;
  selectAllBox.checked = items.length > 0 && selected.size === items.length;
  selectAllBox.indeterminate = selected.size > 0 && selected.size < items.length;
  downloadSelectedButton.disabled = selected.size === 0;

  const total = selectedItems().reduce((sum, item) => sum + (item.contentLength || 0), 0);
  downloadSelectedButton.textContent = confirmBatch
    ? t("confirmDownload", { size: sizeLabel(total) })
    : t("downloadSelected", { count: selected.size });
  downloadSelectedButton.classList.toggle("warn", confirmBatch);
}

// --- Download progress ---------------------------------------------------

function progressText(state) {
  if (!state) return "";
  if (state.state === "complete") return t("downloadComplete");
  if (state.state === "interrupted") {
    return state.error === "USER_CANCELED" ? t("downloadCancelled") : t("downloadFailedReason", { reason: state.error || "?" });
  }
  if (state.totalBytes > 0) {
    const percent = Math.floor((state.bytesReceived / state.totalBytes) * 100);
    return t("progress", {
      percent,
      received: formatBytes(state.bytesReceived) || "0 B",
      total: formatBytes(state.totalBytes)
    });
  }
  return t("progressUnknown", { received: formatBytes(state.bytesReceived) || "0 B" });
}

function phase(state) {
  return state ? state.state : "none";
}

async function refreshDownloads() {
  const tracked = candidates.filter((item) => downloadIds[item.id]);
  let phaseChanged = false;
  for (const item of tracked) {
    const [download] = await chrome.downloads.search({ id: downloadIds[item.id] });
    const previous = downloadState.get(item.id);
    const next = download
      ? { id: download.id, state: download.state, error: download.error, bytesReceived: download.bytesReceived, totalBytes: download.totalBytes }
      : null;
    if (phase(previous) !== phase(next)) phaseChanged = true;
    if (next) downloadState.set(item.id, next);
    else downloadState.delete(item.id);
  }

  if (phaseChanged) render();
  else updateProgressText();

  clearTimeout(pollTimer);
  const running = [...downloadState.values()].some((state) => state.state === "in_progress");
  if (running) pollTimer = setTimeout(refreshDownloads, 1000);
}

function updateProgressText() {
  listElement.querySelectorAll("[data-progress]").forEach((node) => {
    const state = downloadState.get(node.dataset.progress);
    node.textContent = progressText(state);
    node.className = `progress ${phase(state)}`;
  });
}

async function loadDownloadIds() {
  const data = await chrome.storage.session.get(DOWNLOADS_KEY);
  downloadIds = data[DOWNLOADS_KEY] || {};
}

// --- Rendering -------------------------------------------------------------

function actionButtons(item) {
  const state = downloadState.get(item.id);
  const copy = `<button class="ghost" data-copy="${item.id}" type="button">${escapeHtml(t("copy"))}</button>`;
  if (item.kind === "playlist") {
    return `${copy}<button type="button" disabled>${escapeHtml(t("unsupported"))}</button>`;
  }
  if (state?.state === "in_progress") {
    return `${copy}<button class="ghost" data-cancel="${item.id}" type="button">${escapeHtml(t("cancel"))}</button>`;
  }
  if (state?.state === "complete") {
    return `${copy}<button class="ghost" data-show="${item.id}" type="button">${escapeHtml(t("showFile"))}</button>`;
  }
  const confirming = confirmItemId === item.id;
  const label = confirming
    ? t("confirmDownload", { size: sizeLabel(item.contentLength) })
    : state?.state === "interrupted"
      ? t("retry")
      : t("download");
  return `${copy}<button class="${confirming ? "warn" : ""}" data-download="${item.id}" type="button">${escapeHtml(label)}</button>`;
}

function render() {
  const items = visibleCandidates();
  listElement.replaceChildren();

  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = t("emptyList");
    listElement.appendChild(empty);
    updateBatchBar();
    return;
  }

  for (const item of items) {
    const article = document.createElement("article");
    article.className = `candidate ${item.kind}`;
    const canDownload = item.kind !== "playlist";
    const large = isLarge(item.contentLength);
    article.innerHTML = `
      ${
        canDownload
          ? `<input class="pick" type="checkbox" data-select="${item.id}" ${selected.has(item.id) ? "checked" : ""}
               aria-label="${escapeHtml(t("selectItem", { name: item.filename }))}" />`
          : `<span class="pick-spacer"></span>`
      }
      <div class="meta">
        <strong title="${escapeHtml(item.url)}">${escapeHtml(item.filename)}</strong>
        <span>${escapeHtml(t(`kind_${item.kind}`))} · ${escapeHtml(item.contentType || "media")} ·
          <b class="${large ? "large" : ""}">${escapeHtml(sizeLabel(item.contentLength))}</b></span>
        <span class="progress" data-progress="${item.id}"></span>
      </div>
      <div class="actions">${actionButtons(item)}</div>
    `;
    listElement.appendChild(article);
  }
  updateProgressText();
  updateBatchBar();
}

function showCount() {
  const count = downloadable(candidates).length;
  statusElement.textContent =
    count === 0 ? t("noneFound") : count === 1 ? t("foundOne") : t("foundMany", { count });
}

async function loadCandidates(nextCandidates) {
  const tab = await activeTab();
  activeTabId = tab.id;

  if (!tab.url || !/^https?:/.test(tab.url)) {
    statusElement.textContent = tab.url?.startsWith("file:") ? t("localFile") : t("openWebsite");
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

  showCount();
  render();
  await refreshDownloads();
}

// Keep the list live while the popup is open (late frames, lazy players).
chrome.storage.session.onChanged.addListener((changes) => {
  if (changes[DOWNLOADS_KEY]) {
    downloadIds = changes[DOWNLOADS_KEY].newValue || {};
    void refreshDownloads();
  }
  const change = changes.candidatesByTab;
  if (!change || activeTabId == null) return;
  const next = change.newValue?.[activeTabId] || [];
  const ids = (list) => list.map((item) => `${item.id}:${item.contentLength}`).join();
  if (ids(next) === ids(candidates)) return;
  candidates = next;
  showCount();
  render();
});

// --- Actions -------------------------------------------------------------------

listElement.addEventListener("change", (event) => {
  const id = event.target.dataset.select;
  if (!id) return;
  if (event.target.checked) selected.add(id);
  else selected.delete(id);
  confirmBatch = false;
  updateBatchBar();
});

listElement.addEventListener("click", async (event) => {
  const { download: downloadId, copy: copyId, cancel: cancelId, show: showId } = event.target.dataset;
  const itemId = downloadId || copyId || cancelId || showId;
  const item = candidates.find((candidate) => candidate.id === itemId);
  if (!item) return;

  if (copyId) {
    await navigator.clipboard.writeText(item.url);
    statusElement.textContent = t("urlCopied");
    return;
  }

  if (cancelId) {
    await chrome.downloads.cancel(downloadIds[item.id]);
    await refreshDownloads();
    return;
  }

  if (showId) {
    chrome.downloads.show(downloadIds[item.id]);
    return;
  }

  if (isLarge(item.contentLength) && confirmItemId !== item.id) {
    confirmItemId = item.id;
    statusElement.textContent = t("largeFileWarning", { size: sizeLabel(item.contentLength) });
    render();
    return;
  }
  confirmItemId = null;

  event.target.disabled = true;
  event.target.textContent = t("starting");
  const result = await chrome.runtime.sendMessage({
    type: "DOWNLOAD_CANDIDATE",
    tabId: activeTabId,
    candidateId: item.id
  });

  if (result?.ok) {
    statusElement.textContent = t("saving");
    downloadIds[item.id] = result.downloadId;
    await refreshDownloads();
    render();
  } else {
    statusElement.textContent = result?.error || t("downloadFailed");
    render();
  }
});

selectAllBox.addEventListener("change", () => {
  const items = downloadable(visibleCandidates());
  if (selectAllBox.checked) items.forEach((item) => selected.add(item.id));
  else selected.clear();
  confirmBatch = false;
  render();
});

downloadSelectedButton.addEventListener("click", async () => {
  const items = selectedItems();
  if (!items.length) return;

  const total = items.reduce((sum, item) => sum + (item.contentLength || 0), 0);
  if (isLarge(total) && !confirmBatch) {
    confirmBatch = true;
    statusElement.textContent = t("batchLargeWarning", { size: sizeLabel(total), count: items.length });
    updateBatchBar();
    return;
  }
  confirmBatch = false;

  downloadSelectedButton.disabled = true;
  downloadSelectedButton.textContent = t("starting");
  const result = await chrome.runtime.sendMessage({
    type: "DOWNLOAD_CANDIDATES",
    tabId: activeTabId,
    candidateIds: items.map((item) => item.id)
  });

  statusElement.textContent = result?.ok
    ? t("batchStarted", { count: result.started })
    : t("batchPartial", { ok: result?.started || 0, total: items.length, error: result?.error || "" });
  for (const entry of result?.results || []) {
    if (!entry.ok) continue;
    selected.delete(entry.id);
    downloadIds[entry.id] = entry.downloadId;
  }
  render();
  await refreshDownloads();
});

document.querySelectorAll(".filters button").forEach((button) => {
  button.addEventListener("click", () => {
    filter = button.dataset.filter;
    confirmItemId = null;
    confirmBatch = false;
    document.querySelectorAll(".filters button").forEach((node) => node.classList.toggle("active", node === button));
    render();
  });
});

scanButton.addEventListener("click", async () => {
  statusElement.textContent = t("scanning");
  const result = await chrome.runtime.sendMessage({ type: "SCAN_PAGE", tabId: activeTabId });
  await loadCandidates(result?.candidates);
  if (result?.error) statusElement.textContent = result.error;
});

clearButton.addEventListener("click", async () => {
  selected.clear();
  confirmItemId = null;
  confirmBatch = false;
  await chrome.runtime.sendMessage({ type: "CLEAR_CANDIDATES", tabId: activeTabId });
  await loadCandidates([]);
});

optionsButton.addEventListener("click", () => chrome.runtime.openOptionsPage());

async function init() {
  try {
    const result = await chrome.runtime.sendMessage({ type: "GET_SETTINGS" });
    settings = result?.settings || {};
    const language = resolveLanguage(settings.language, navigator.language);
    t = translator(language);
    document.documentElement.lang = language;
  } catch {
    /* fall back to English and defaults */
  }
  applyTranslations(document, t);
  await loadDownloadIds();
  await loadCandidates();
}

init();
