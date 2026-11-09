importScripts("shared.js");

const {
  DEFAULT_SETTINGS,
  STREAMING_CDN_HOSTS,
  sanitizeFilename,
  filenameFromUrl,
  filenameFromContentDisposition,
  withExtension,
  classify,
  totalSizeFromHeaders,
  isAllowed,
  normalizeSettings,
  mergeManaged,
  buildRelativePath,
  mediaLinkPatterns
} = self.HarmonyShared;

const CANDIDATES_KEY = "candidatesByTab";
const SETTINGS_KEY = "settings";
const HISTORY_KEY = "downloadHistory";
const HISTORY_LIMIT = 100;
const EXTENSION_ORIGIN = chrome.runtime.getURL("");

// --- Serialized storage access -------------------------------------------
// Media requests arrive in bursts. Every read-modify-write of the candidate
// map and history goes through one queue so concurrent updates are not lost.
let queue = Promise.resolve();
function serialized(task) {
  const run = queue.then(task, task);
  queue = run.catch(() => {});
  return run;
}

function headerValue(headers = [], name) {
  const lower = name.toLowerCase();
  return headers.find((header) => header.name.toLowerCase() === lower)?.value || "";
}

// Policy an administrator sets through Chrome (Google Admin console or
// enterprise policy). Empty for most users.
async function getManagedPolicy() {
  try {
    return (await chrome.storage.managed.get(null)) || {};
  } catch {
    return {};
  }
}

async function getSettingsState() {
  const [data, managed] = await Promise.all([chrome.storage.local.get(SETTINGS_KEY), getManagedPolicy()]);
  return mergeManaged(data[SETTINGS_KEY], managed);
}

async function getSettings() {
  return (await getSettingsState()).settings;
}

async function getCandidatesMap() {
  const data = await chrome.storage.session.get(CANDIDATES_KEY);
  return data[CANDIDATES_KEY] || {};
}

async function setCandidatesMap(map) {
  await chrome.storage.session.set({ [CANDIDATES_KEY]: map });
}

async function tabInfo(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    return { urls: [tab.url, tab.pendingUrl].filter(Boolean), title: tab.title || "" };
  } catch {
    return { urls: [], title: "" };
  }
}

async function updateBadge(tabId, list) {
  if (!tabId || tabId < 0) return;
  const count = (list || []).filter((item) => item.kind !== "playlist").length;
  try {
    await chrome.action.setBadgeBackgroundColor({ tabId, color: "#01696F" });
    await chrome.action.setBadgeText({ tabId, text: count ? String(count) : "" });
  } catch {
    /* tab closed */
  }
}

/**
 * Merge detected media into a tab's list.
 * @param {number} tabId
 * @param {Array} incoming   detected items ({url, filename?, contentType?, contentLength?, kind?})
 * @param {string[]} context URLs that describe where the media came from
 *                           (frame URL, request initiator). The tab URL is added here.
 */
function addCandidates(tabId, incoming, context = []) {
  if (!tabId || tabId < 0 || !incoming?.length) return Promise.resolve();
  return serialized(async () => {
    const settings = await getSettings();
    const { urls: pageUrls, title: pageTitle } = await tabInfo(tabId);
    const map = await getCandidatesMap();
    const next = [...(map[tabId] || [])];
    let changed = false;

    for (const item of incoming) {
      if (!item?.url || !/^https?:/i.test(item.url)) continue;
      if (!isAllowed([item.url, ...context, ...pageUrls], settings)) continue;

      // Content type and extension win; the page element's tag is a fallback.
      let kind = classify(item.url, item.contentType);
      if (kind === "unknown" && (item.kind === "audio" || item.kind === "video")) kind = item.kind;
      if (kind === "unknown") continue;
      if (kind === "playlist" && !settings.showPlaylists) continue;

      const contentLength = Number(item.contentLength || 0);
      const existing = next.find((candidate) => candidate.url === item.url);
      if (existing) {
        // The page script often reports a file before its network response
        // arrives. The response knows the real type and file name, so it
        // upgrades the entry.
        if (item.fromNetwork && !existing.fromNetwork) {
          existing.fromNetwork = true;
          existing.contentType = item.contentType || existing.contentType;
          existing.kind = kind;
          existing.filename = sanitizeFilename(
            withExtension(item.filename || existing.filename, existing.contentType)
          );
          changed = true;
        }
        if (pageTitle && !existing.pageTitle) {
          existing.pageTitle = pageTitle;
          changed = true;
        }
        // Later responses (e.g. a ranged request) may carry a better size.
        if (contentLength > (existing.contentLength || 0)) {
          existing.contentLength = contentLength;
          changed = true;
        }
        continue;
      }

      next.unshift({
        id: crypto.randomUUID(),
        url: item.url,
        filename: sanitizeFilename(
          withExtension(item.filename || filenameFromUrl(item.url, item.contentType), item.contentType)
        ),
        contentType: item.contentType || "",
        contentLength,
        kind,
        fromNetwork: Boolean(item.fromNetwork),
        pageUrl: pageUrls[0] || "",
        pageTitle,
        detectedAt: Date.now()
      });
      changed = true;
    }

    if (!changed) return;
    map[tabId] = next.slice(0, settings.maxCandidates);
    await setCandidatesMap(map);
    await updateBadge(tabId, map[tabId]);
  });
}

function clearCandidates(tabId, { remove = false } = {}) {
  return serialized(async () => {
    const map = await getCandidatesMap();
    if (remove) delete map[tabId];
    else map[tabId] = [];
    await setCandidatesMap(map);
    if (!remove) await updateBadge(tabId, []);
  });
}

function recordHistory(entry) {
  return serialized(async () => {
    const data = await chrome.storage.local.get(HISTORY_KEY);
    const history = [entry, ...(data[HISTORY_KEY] || [])].slice(0, HISTORY_LIMIT);
    await chrome.storage.local.set({ [HISTORY_KEY]: history });
  });
}

async function startDownload({ url, filename, pageUrl = "", pageTitle = "", kind = "", source, saveAs }) {
  const settings = await getSettings();
  const safeName = sanitizeFilename(filename || filenameFromUrl(url));
  const relativePath = buildRelativePath(settings.filenameTemplate, {
    filename: safeName,
    pageUrl,
    pageTitle,
    kind
  });
  const downloadId = await chrome.downloads.download({
    url,
    filename: `${sanitizeFilename(settings.folderName)}/${relativePath}`,
    conflictAction: "uniquify",
    saveAs: saveAs ?? settings.saveAs
  });

  await recordHistory({
    id: crypto.randomUUID(),
    url,
    filename: safeName,
    path: relativePath,
    pageUrl,
    source,
    downloadId,
    downloadedAt: Date.now()
  });

  return downloadId;
}

// --- Install / update ----------------------------------------------------

function compareVersions(a, b) {
  const pa = String(a || "0").split(".").map(Number);
  const pb = String(b || "0").split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff) return Math.sign(diff);
  }
  return 0;
}

function createContextMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "save-media",
      title: "Save media with Harmony Media Saver",
      contexts: ["video", "audio"]
    });
    chrome.contextMenus.create({
      id: "save-media-link",
      title: "Save linked media with Harmony Media Saver",
      contexts: ["link"],
      targetUrlPatterns: mediaLinkPatterns()
    });
  });
}

chrome.runtime.onInstalled.addListener(async (details) => {
  const current = await chrome.storage.local.get(SETTINGS_KEY);
  const stored = current[SETTINGS_KEY];

  if (!stored) {
    await chrome.storage.local.set({ [SETTINGS_KEY]: normalizeSettings(DEFAULT_SETTINGS) });
  } else if (details.reason === "update" && compareVersions(details.previousVersion, "1.1.0") < 0) {
    // 1.1.0 added the streaming CDNs to the default blocklist. Add them once
    // for existing users; later removals by the user are respected.
    const settings = normalizeSettings(stored);
    settings.blockedHosts = normalizeSettings({
      blockedHosts: [...settings.blockedHosts, ...STREAMING_CDN_HOSTS]
    }).blockedHosts;
    await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
  }

  createContextMenus();
});

// --- Detection -----------------------------------------------------------

// A real navigation of the top frame starts a new page: forget the old list.
// Single-page apps that only change the URL with history.pushState keep it.
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (details.tabId >= 0 && details.frameId === 0) void clearCandidates(details.tabId);
  },
  { urls: ["<all_urls>"], types: ["main_frame"] }
);

chrome.webRequest.onHeadersReceived.addListener(
  (details) => {
    if (details.tabId < 0) return;
    if (details.statusCode >= 400) return;
    const headers = details.responseHeaders;
    const contentType = headerValue(headers, "content-type");
    if (classify(details.url, contentType) === "unknown") return;

    const dispositionName = filenameFromContentDisposition(headerValue(headers, "content-disposition"));
    void addCandidates(
      details.tabId,
      [
        {
          url: details.url,
          fromNetwork: true,
          filename: dispositionName || filenameFromUrl(details.url, contentType),
          contentType,
          contentLength: totalSizeFromHeaders(
            headerValue(headers, "content-range"),
            headerValue(headers, "content-length"),
            details.statusCode
          )
        }
      ],
      [details.initiator, details.documentUrl].filter(Boolean)
    );
  },
  { urls: ["<all_urls>"] },
  ["responseHeaders"]
);

chrome.tabs.onRemoved.addListener((tabId) => {
  void clearCandidates(tabId, { remove: true });
});

// --- Context menu --------------------------------------------------------

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const url = info.srcUrl || info.linkUrl;
  if (!url || !/^https?:/i.test(url)) return;

  const settings = await getSettings();
  const context = [url, info.pageUrl, info.frameUrl, tab?.url].filter(Boolean);
  if (!isAllowed(context, settings)) return;
  if (classify(url, "") === "playlist") return;

  if (tab?.id >= 0) await addCandidates(tab.id, [{ url }], context);
  await startDownload({
    url,
    filename: filenameFromUrl(url),
    pageUrl: info.pageUrl || tab?.url || "",
    pageTitle: tab?.title || "",
    kind: classify(url, ""),
    source: "context-menu"
  });
});

// --- Messages ------------------------------------------------------------

async function downloadCandidate(tabId, candidateId, { source, saveAs } = {}) {
  const map = await getCandidatesMap();
  const candidate = (map[tabId] || []).find((item) => item.id === candidateId);
  if (!candidate) return { ok: false, error: "That media item is no longer available." };
  if (candidate.kind === "playlist") {
    return { ok: false, error: "This is a streaming playlist, not a single downloadable file." };
  }
  const settings = await getSettings();
  if (!isAllowed([candidate.url, candidate.pageUrl].filter(Boolean), settings)) {
    return { ok: false, error: "This site is blocked by your settings." };
  }
  try {
    const downloadId = await startDownload({
      url: candidate.url,
      filename: candidate.filename,
      pageUrl: candidate.pageUrl,
      pageTitle: candidate.pageTitle,
      kind: candidate.kind,
      source,
      saveAs
    });
    return { ok: true, downloadId };
  } catch (error) {
    return { ok: false, error: error?.message || String(error) };
  }
}

function isExtensionPage(sender) {
  return sender.id === chrome.runtime.id && String(sender.url || "").startsWith(EXTENSION_ORIGIN);
}

async function handleContentScriptMessage(message, sender) {
  if (message.type !== "PAGE_CANDIDATES") return { ok: false, error: "Not allowed." };
  const tabId = sender.tab?.id;
  await addCandidates(tabId, message.candidates || [], [sender.url, sender.origin].filter(Boolean));
  return { ok: true };
}

async function handleExtensionPageMessage(message) {
  const tabId = message.tabId;

  switch (message.type) {
    case "GET_CANDIDATES": {
      const map = await getCandidatesMap();
      return { candidates: map[tabId] || [] };
    }

    case "SCAN_PAGE": {
      try {
        // Every frame's content script reports its own media via
        // PAGE_CANDIDATES; the popup picks up late frames through storage events.
        await chrome.tabs.sendMessage(tabId, { type: "SCAN_PAGE" });
      } catch {
        return { ok: false, error: "This page cannot be scanned. Reload the page and try again." };
      }
      await serialized(() => {});
      const map = await getCandidatesMap();
      return { ok: true, candidates: map[tabId] || [] };
    }

    case "CLEAR_CANDIDATES":
      await clearCandidates(tabId);
      return { ok: true };

    case "GET_SETTINGS": {
      const { settings, managedKeys } = await getSettingsState();
      return {
        settings,
        managedKeys,
        defaults: normalizeSettings(DEFAULT_SETTINGS),
        version: chrome.runtime.getManifest().version
      };
    }

    case "SAVE_SETTINGS": {
      // Stored as the user's own choice; managed policy is applied on read.
      await chrome.storage.local.set({ [SETTINGS_KEY]: normalizeSettings(message.settings) });
      const { settings, managedKeys } = await getSettingsState();
      return { ok: true, settings, managedKeys };
    }

    case "GET_HISTORY": {
      const data = await chrome.storage.local.get(HISTORY_KEY);
      return { history: data[HISTORY_KEY] || [] };
    }

    case "CLEAR_HISTORY":
      await serialized(() => chrome.storage.local.set({ [HISTORY_KEY]: [] }));
      return { ok: true };

    case "DOWNLOAD_CANDIDATE":
      return downloadCandidate(tabId, message.candidateId, { source: "popup" });

    case "DOWNLOAD_CANDIDATES": {
      // One Save As dialog per file would be unusable for a batch, so batch
      // downloads always go straight to the download folder.
      const ids = Array.isArray(message.candidateIds) ? message.candidateIds.slice(0, 100) : [];
      const results = [];
      for (const id of ids) {
        results.push({ id, ...(await downloadCandidate(tabId, id, { source: "batch", saveAs: false })) });
      }
      const failed = results.filter((result) => !result.ok);
      return {
        ok: failed.length === 0,
        started: results.length - failed.length,
        total: results.length,
        results,
        error: failed[0]?.error
      };
    }

    default:
      return { ok: false, error: "Unknown message." };
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || !message?.type) return false;

  const handler = isExtensionPage(sender)
    ? handleExtensionPageMessage(message)
    : handleContentScriptMessage(message, sender);

  handler
    .then(sendResponse)
    .catch((error) => sendResponse({ ok: false, error: error?.message || String(error) }));
  return true;
});
