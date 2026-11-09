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

async function getSettings() {
  const data = await chrome.storage.local.get(SETTINGS_KEY);
  return normalizeSettings(data[SETTINGS_KEY]);
}

async function getCandidatesMap() {
  const data = await chrome.storage.session.get(CANDIDATES_KEY);
  return data[CANDIDATES_KEY] || {};
}

async function setCandidatesMap(map) {
  await chrome.storage.session.set({ [CANDIDATES_KEY]: map });
}

async function tabUrls(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    return [tab.url, tab.pendingUrl].filter(Boolean);
  } catch {
    return [];
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
    const pageUrls = await tabUrls(tabId);
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
        pageUrl: pageUrls[0] || "",
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

async function startDownload({ url, filename, pageUrl = "", source }) {
  const settings = await getSettings();
  const safeName = sanitizeFilename(filename || filenameFromUrl(url));
  const downloadId = await chrome.downloads.download({
    url,
    filename: `${sanitizeFilename(settings.folderName)}/${safeName}`,
    conflictAction: "uniquify",
    saveAs: settings.saveAs
  });

  await recordHistory({
    id: crypto.randomUUID(),
    url,
    filename: safeName,
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
    source: "context-menu"
  });
});

// --- Messages ------------------------------------------------------------

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

    case "GET_SETTINGS":
      return { settings: await getSettings(), defaults: normalizeSettings(DEFAULT_SETTINGS) };

    case "SAVE_SETTINGS": {
      const settings = normalizeSettings(message.settings);
      await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
      return { ok: true, settings };
    }

    case "GET_HISTORY": {
      const data = await chrome.storage.local.get(HISTORY_KEY);
      return { history: data[HISTORY_KEY] || [] };
    }

    case "CLEAR_HISTORY":
      await serialized(() => chrome.storage.local.set({ [HISTORY_KEY]: [] }));
      return { ok: true };

    case "DOWNLOAD_CANDIDATE": {
      const map = await getCandidatesMap();
      const candidate = (map[tabId] || []).find((item) => item.id === message.candidateId);
      if (!candidate) return { ok: false, error: "That media item is no longer available." };
      if (candidate.kind === "playlist") {
        return { ok: false, error: "This is a streaming playlist, not a single downloadable file." };
      }
      const settings = await getSettings();
      if (!isAllowed([candidate.url, candidate.pageUrl].filter(Boolean), settings)) {
        return { ok: false, error: "This site is blocked by your settings." };
      }
      const downloadId = await startDownload({
        url: candidate.url,
        filename: candidate.filename,
        pageUrl: candidate.pageUrl,
        source: "popup"
      });
      return { ok: true, downloadId };
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
