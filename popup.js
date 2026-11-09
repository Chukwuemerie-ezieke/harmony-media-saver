const { escapeHtml } = globalThis.HarmonyShared;
const { resolveLanguage, translator, applyTranslations } = globalThis.HarmonyI18n;

const statusElement = document.querySelector("#status");
const listElement = document.querySelector("#candidateList");
const scanButton = document.querySelector("#scanButton");
const clearButton = document.querySelector("#clearButton");
const optionsButton = document.querySelector("#optionsButton");
const batchBar = document.querySelector("#batchBar");
const selectAllBox = document.querySelector("#selectAll");
const downloadSelectedButton = document.querySelector("#downloadSelected");

let t = translator("en");
let activeTabId = null;
let candidates = [];
let filter = "all";
const selected = new Set();

function formatBytes(bytes) {
  if (!bytes) return t("sizeUnavailable");
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
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

function updateBatchBar() {
  const items = downloadable(visibleCandidates());
  // Forget selections for items that are gone or filtered out.
  const visibleIds = new Set(items.map((item) => item.id));
  for (const id of selected) if (!visibleIds.has(id)) selected.delete(id);

  batchBar.hidden = items.length < 2;
  selectAllBox.checked = items.length > 0 && selected.size === items.length;
  selectAllBox.indeterminate = selected.size > 0 && selected.size < items.length;
  downloadSelectedButton.disabled = selected.size === 0;
  downloadSelectedButton.textContent = t("downloadSelected", { count: selected.size });
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
    const kindLabel = t(`kind_${item.kind}`);
    article.innerHTML = `
      ${
        canDownload
          ? `<input class="pick" type="checkbox" data-select="${item.id}" ${selected.has(item.id) ? "checked" : ""}
               aria-label="${escapeHtml(t("selectItem", { name: item.filename }))}" />`
          : `<span class="pick-spacer"></span>`
      }
      <div class="meta">
        <strong title="${escapeHtml(item.url)}">${escapeHtml(item.filename)}</strong>
        <span>${escapeHtml(kindLabel)} · ${escapeHtml(item.contentType || "media")} · ${escapeHtml(formatBytes(item.contentLength))}</span>
      </div>
      <div class="actions">
        <button class="ghost" data-copy="${item.id}" type="button">${escapeHtml(t("copy"))}</button>
        <button data-download="${item.id}" type="button" ${canDownload ? "" : "disabled"}>
          ${escapeHtml(canDownload ? t("download") : t("unsupported"))}
        </button>
      </div>
    `;
    listElement.appendChild(article);
  }
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
}

// Keep the list live while the popup is open (late frames, lazy players).
chrome.storage.session.onChanged.addListener((changes) => {
  const change = changes.candidatesByTab;
  if (!change || activeTabId == null) return;
  const next = change.newValue?.[activeTabId] || [];
  const ids = (list) => list.map((item) => `${item.id}:${item.contentLength}`).join();
  if (ids(next) === ids(candidates)) return;
  candidates = next;
  showCount();
  render();
});

listElement.addEventListener("change", (event) => {
  const id = event.target.dataset.select;
  if (!id) return;
  if (event.target.checked) selected.add(id);
  else selected.delete(id);
  updateBatchBar();
});

listElement.addEventListener("click", async (event) => {
  const downloadId = event.target.dataset.download;
  const copyId = event.target.dataset.copy;
  const item = candidates.find((candidate) => candidate.id === downloadId || candidate.id === copyId);
  if (!item) return;

  if (copyId) {
    await navigator.clipboard.writeText(item.url);
    statusElement.textContent = t("urlCopied");
    return;
  }

  event.target.disabled = true;
  event.target.textContent = t("starting");
  const result = await chrome.runtime.sendMessage({
    type: "DOWNLOAD_CANDIDATE",
    tabId: activeTabId,
    candidateId: item.id
  });

  if (result?.ok) {
    event.target.textContent = t("started");
    statusElement.textContent = t("saving");
  } else {
    event.target.disabled = item.kind === "playlist";
    event.target.textContent = item.kind === "playlist" ? t("unsupported") : t("retry");
    statusElement.textContent = result?.error || t("downloadFailed");
  }
});

selectAllBox.addEventListener("change", () => {
  const items = downloadable(visibleCandidates());
  if (selectAllBox.checked) items.forEach((item) => selected.add(item.id));
  else selected.clear();
  render();
});

downloadSelectedButton.addEventListener("click", async () => {
  const candidateIds = [...selected];
  if (!candidateIds.length) return;
  downloadSelectedButton.disabled = true;
  downloadSelectedButton.textContent = t("starting");

  const result = await chrome.runtime.sendMessage({
    type: "DOWNLOAD_CANDIDATES",
    tabId: activeTabId,
    candidateIds
  });

  statusElement.textContent = result?.ok
    ? t("batchStarted", { count: result.started })
    : t("batchPartial", { ok: result?.started || 0, total: candidateIds.length, error: result?.error || "" });
  for (const entry of result?.results || []) if (entry.ok) selected.delete(entry.id);
  render();
});

document.querySelectorAll(".filters button").forEach((button) => {
  button.addEventListener("click", () => {
    filter = button.dataset.filter;
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
  await chrome.runtime.sendMessage({ type: "CLEAR_CANDIDATES", tabId: activeTabId });
  await loadCandidates([]);
});

optionsButton.addEventListener("click", () => chrome.runtime.openOptionsPage());

async function init() {
  try {
    const { settings } = await chrome.runtime.sendMessage({ type: "GET_SETTINGS" });
    const language = resolveLanguage(settings?.language, navigator.language);
    t = translator(language);
    document.documentElement.lang = language;
  } catch {
    /* fall back to English */
  }
  applyTranslations(document, t);
  await loadCandidates();
}

init();
