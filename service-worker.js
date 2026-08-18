const CANDIDATES_KEY = "candidatesByTab";
const SETTINGS_KEY = "settings";
const HISTORY_KEY = "downloadHistory";

const DEFAULT_BLOCKED_HOSTS = [
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "netflix.com",
  "www.netflix.com",
  "disneyplus.com",
  "www.disneyplus.com",
  "hulu.com",
  "www.hulu.com",
  "max.com",
  "www.max.com",
  "play.hbomax.com",
  "primevideo.com",
  "www.primevideo.com",
  "spotify.com",
  "open.spotify.com",
  "tiktok.com",
  "www.tiktok.com",
  "instagram.com",
  "www.instagram.com",
  "facebook.com",
  "www.facebook.com",
  "twitch.tv",
  "www.twitch.tv"
];

const DEFAULT_SETTINGS = {
  saveAs: true,
  folderName: "HarmonyMedia",
  blockedHosts: DEFAULT_BLOCKED_HOSTS,
  allowlistHosts: [],
  maxCandidates: 50,
  showPlaylists: true
};

const MEDIA_EXTENSIONS = /\.(mp4|webm|mov|m4v|ogv|mkv|avi|mp3|m4a|aac|wav|ogg|flac)(?:$|[?#])/i;
const PLAYLIST_EXTENSIONS = /\.(m3u8|mpd)(?:$|[?#])/i;

function hostnameOf(urlString) {
  try {
    return new URL(urlString).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function hostMatches(hostname, pattern) {
  const value = String(pattern || "").trim().toLowerCase();
  if (!hostname || !value) return false;
  return hostname === value || hostname.endsWith(`.${value}`);
}

function headerValue(headers = [], name) {
  return (
    headers.find((header) => header.name.toLowerCase() === name.toLowerCase())
      ?.value || ""
  );
}

function sanitizeFilename(name) {
  const cleaned = String(name || "")
    .split(/[\\/]/)
    .pop()
    .replace(/[<>:"|?*\u0000-\u001f]/g, "_")
    .trim();
  return cleaned.slice(0, 180) || "media-download";
}

function filenameFromUrl(urlString) {
  try {
    const name = decodeURIComponent(new URL(urlString).pathname.split("/").pop() || "");
    return sanitizeFilename(name.includes(".") ? name : "media-download");
  } catch {
    return "media-download";
  }
}

function classify(urlString, contentType) {
  const type = (contentType || "").toLowerCase().split(";")[0].trim();
  if (PLAYLIST_EXTENSIONS.test(urlString) || type.includes("mpegurl") || type.includes("dash+xml")) {
    return "playlist";
  }
  if (type.startsWith("audio/") || /\.(mp3|m4a|aac|wav|ogg|flac)(?:$|[?#])/i.test(urlString)) {
    return "audio";
  }
  if (type.startsWith("video/") || MEDIA_EXTENSIONS.test(urlString)) {
    return "video";
  }
  return "unknown";
}

function isDirectMedia(urlString, contentType) {
  const type = (contentType || "").toLowerCase().split(";")[0].trim();
  return (
    type.startsWith("video/") ||
    type.startsWith("audio/") ||
    MEDIA_EXTENSIONS.test(urlString) ||
    PLAYLIST_EXTENSIONS.test(urlString)
  );
}

async function getSettings() {
  const data = await chrome.storage.local.get(SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS, ...(data[SETTINGS_KEY] || {}) };
}

async function getCandidatesMap() {
  const data = await chrome.storage.session.get(CANDIDATES_KEY);
  return data[CANDIDATES_KEY] || {};
}

async function setCandidatesMap(map) {
  await chrome.storage.session.set({ [CANDIDATES_KEY]: map });
}

function isHostAllowed(urlString, settings) {
  const hostname = hostnameOf(urlString);
  if (!hostname) return false;
  if ((settings.blockedHosts || []).some((host) => hostMatches(hostname, host))) {
    return false;
  }
  const allowlist = (settings.allowlistHosts || []).map((host) => host.trim()).filter(Boolean);
  if (allowlist.length && !allowlist.some((host) => hostMatches(hostname, host))) {
    return false;
  }
  return true;
}

async function updateBadge(tabId) {
  if (!tabId || tabId < 0) return;
  const map = await getCandidatesMap();
  const count = (map[tabId] || []).filter((item) => item.kind !== "playlist").length;
  await chrome.action.setBadgeBackgroundColor({ tabId, color: "#01696F" });
  await chrome.action.setBadgeText({ tabId, text: count ? String(count) : "" });
}

async function addCandidates(tabId, incoming) {
  if (!tabId || tabId < 0 || !incoming?.length) return;
  const settings = await getSettings();
  const map = await getCandidatesMap();
  const existing = map[tabId] || [];
  const next = [...existing];

  for (const item of incoming) {
    if (!item?.url || item.url.startsWith("blob:") || item.url.startsWith("mediastream:")) continue;
    if (!isHostAllowed(item.url, settings)) continue;
    if (next.some((candidate) => candidate.url === item.url)) continue;

    const kind = item.kind || classify(item.url, item.contentType);
    if (kind === "playlist" && !settings.showPlaylists) continue;
    if (kind === "unknown" && !MEDIA_EXTENSIONS.test(item.url)) continue;

    next.unshift({
      id: crypto.randomUUID(),
      url: item.url,
      filename: sanitizeFilename(item.filename || filenameFromUrl(item.url)),
      contentType: item.contentType || "",
      contentLength: Number(item.contentLength || 0),
      kind,
      detectedAt: Date.now()
    });
  }

  map[tabId] = next.slice(0, settings.maxCandidates || 50);
  await setCandidatesMap(map);
  await updateBadge(tabId);
}

async function recordHistory(entry) {
  const data = await chrome.storage.local.get(HISTORY_KEY);
  const history = [entry, ...(data[HISTORY_KEY] || [])].slice(0, 100);
  await chrome.storage.local.set({ [HISTORY_KEY]: history });
}

chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.local.get(SETTINGS_KEY);
  if (!current[SETTINGS_KEY]) {
    await chrome.storage.local.set({ [SETTINGS_KEY]: DEFAULT_SETTINGS });
  }

  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "save-media",
      title: "Save media with Harmony Media Saver",
      contexts: ["video", "audio", "link"]
    });
  });
});

chrome.webRequest.onHeadersReceived.addListener(
  (details) => {
    if (details.tabId < 0) return;
    const contentType = headerValue(details.responseHeaders, "content-type");
    if (!isDirectMedia(details.url, contentType)) return;

    void addCandidates(details.tabId, [
      {
        url: details.url,
        filename: filenameFromUrl(details.url),
        contentType,
        contentLength: Number(headerValue(details.responseHeaders, "content-length") || 0)
      }
    ]);
  },
  { urls: ["<all_urls>"] },
  ["responseHeaders"]
);

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const map = await getCandidatesMap();
  delete map[tabId];
  await setCandidatesMap(map);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (!changeInfo.url) return;
  const map = await getCandidatesMap();
  map[tabId] = [];
  await setCandidatesMap(map);
  await updateBadge(tabId);
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const url = info.srcUrl || info.linkUrl;
  if (!url || !tab?.id) return;
  await addCandidates(tab.id, [{ url, filename: filenameFromUrl(url) }]);
  const settings = await getSettings();
  if (!isHostAllowed(url, settings)) return;
  const kind = classify(url, "");
  if (kind === "playlist") return;

  chrome.downloads.download({
    url,
    filename: `${sanitizeFilename(settings.folderName)}/${filenameFromUrl(url)}`,
    conflictAction: "uniquify",
    saveAs: settings.saveAs
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const tabId = message.tabId ?? sender.tab?.id;

  const respond = async () => {
    if (message.type === "GET_CANDIDATES") {
      const map = await getCandidatesMap();
      return { candidates: map[tabId] || [] };
    }

    if (message.type === "PAGE_CANDIDATES") {
      await addCandidates(tabId, message.candidates || []);
      return { ok: true };
    }

    if (message.type === "SCAN_PAGE") {
      try {
        const response = await chrome.tabs.sendMessage(tabId, { type: "SCAN_PAGE" });
        await addCandidates(tabId, response?.candidates || []);
      } catch {
        return { ok: false, error: "This page cannot be scanned." };
      }
      const map = await getCandidatesMap();
      return { ok: true, candidates: map[tabId] || [] };
    }

    if (message.type === "CLEAR_CANDIDATES") {
      const map = await getCandidatesMap();
      map[tabId] = [];
      await setCandidatesMap(map);
      await updateBadge(tabId);
      return { ok: true };
    }

    if (message.type === "GET_SETTINGS") {
      return { settings: await getSettings(), defaults: DEFAULT_SETTINGS };
    }

    if (message.type === "SAVE_SETTINGS") {
      const settings = { ...DEFAULT_SETTINGS, ...(message.settings || {}) };
      settings.folderName = sanitizeFilename(settings.folderName || "HarmonyMedia");
      settings.blockedHosts = (settings.blockedHosts || []).map((host) => host.trim()).filter(Boolean);
      settings.allowlistHosts = (settings.allowlistHosts || [])
        .map((host) => host.trim())
        .filter(Boolean);
      await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
      return { ok: true, settings };
    }

    if (message.type === "GET_HISTORY") {
      const data = await chrome.storage.local.get(HISTORY_KEY);
      return { history: data[HISTORY_KEY] || [] };
    }

    if (message.type === "CLEAR_HISTORY") {
      await chrome.storage.local.set({ [HISTORY_KEY]: [] });
      return { ok: true };
    }

    if (message.type === "DOWNLOAD_CANDIDATE") {
      const settings = await getSettings();
      const map = await getCandidatesMap();
      const candidate = (map[tabId] || []).find((item) => item.id === message.candidateId);
      if (!candidate) return { ok: false, error: "That media item is no longer available." };
      if (candidate.kind === "playlist") {
        return {
          ok: false,
          error: "This is a streaming playlist, not a single downloadable file."
        };
      }

      const filename = `${sanitizeFilename(settings.folderName)}/${candidate.filename}`;
      const downloadId = await chrome.downloads.download({
        url: candidate.url,
        filename,
        conflictAction: "uniquify",
        saveAs: settings.saveAs
      });

      await recordHistory({
        id: crypto.randomUUID(),
        url: candidate.url,
        filename: candidate.filename,
        downloadedAt: Date.now()
      });

      return { ok: true, downloadId };
    }

    return { ok: false, error: "Unknown message." };
  };

  respond()
    .then(sendResponse)
    .catch((error) => sendResponse({ ok: false, error: error.message || String(error) }));
  return true;
});
