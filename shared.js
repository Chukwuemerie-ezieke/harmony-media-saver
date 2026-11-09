/*
 * Shared helpers for Harmony Media Saver.
 *
 * Loaded as a classic script by the service worker (importScripts), the
 * content script (listed before it in the manifest) and the extension pages,
 * and as a CommonJS module by the Node test suite.
 */
(function (root) {
  const AUDIO_EXTENSIONS = ["mp3", "m4a", "aac", "wav", "ogg", "oga", "opus", "flac"];
  const VIDEO_EXTENSIONS = ["mp4", "webm", "mov", "m4v", "ogv", "mkv", "avi"];
  const PLAYLIST_EXTENSIONS = ["m3u8", "mpd"];

  const extensionPattern = (list) => new RegExp(`\\.(${list.join("|")})(?:$|[?#])`, "i");
  const AUDIO_EXT = extensionPattern(AUDIO_EXTENSIONS);
  const MEDIA_EXT = extensionPattern([...VIDEO_EXTENSIONS, ...AUDIO_EXTENSIONS]);
  const PLAYLIST_EXT = extensionPattern(PLAYLIST_EXTENSIONS);

  // Streaming sites, plus the CDNs they serve media from. The CDN entries
  // matter because a site's video bytes rarely come from the site's own host.
  const STREAMING_CDN_HOSTS = [
    "googlevideo.com",
    "nflxvideo.net",
    "cdninstagram.com",
    "fbcdn.net",
    "tiktokcdn.com",
    "tiktokcdn-us.com",
    "tiktokv.com",
    "ttvnw.net",
    "scdn.co",
    "spotifycdn.com",
    "dssott.com",
    "bamgrid.com",
    "hulustream.com",
    "aiv-cdn.net",
    "aiv-delivery.net"
  ];

  const DEFAULT_BLOCKED_HOSTS = [
    "youtube.com",
    "youtu.be",
    "youtube-nocookie.com",
    "netflix.com",
    "disneyplus.com",
    "hulu.com",
    "max.com",
    "hbomax.com",
    "primevideo.com",
    "spotify.com",
    "tiktok.com",
    "instagram.com",
    "facebook.com",
    "twitch.tv",
    ...STREAMING_CDN_HOSTS
  ];

  const DEFAULT_SETTINGS = {
    saveAs: true,
    folderName: "HarmonyMedia",
    blockedHosts: DEFAULT_BLOCKED_HOSTS,
    allowlistHosts: [],
    maxCandidates: 50,
    showPlaylists: true,
    filenameTemplate: "{filename}",
    language: "auto",
    // Ask before downloading files bigger than this many MB (0 = never ask).
    largeFileWarningMB: 500
  };

  const LANGUAGE_CODES = ["auto", "en", "ha", "yo", "ig", "pcm"];
  const SETTING_KEYS = Object.keys(DEFAULT_SETTINGS);
  const TEMPLATE_TOKENS = ["filename", "name", "ext", "site", "title", "date", "kind"];

  const CONTENT_TYPE_EXTENSIONS = {
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
    "video/x-m4v": "m4v",
    "video/ogg": "ogv",
    "video/x-matroska": "mkv",
    "video/x-msvideo": "avi",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/mp4": "m4a",
    "audio/x-m4a": "m4a",
    "audio/aac": "aac",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/wave": "wav",
    "audio/ogg": "ogg",
    "audio/opus": "opus",
    "audio/flac": "flac",
    "audio/x-flac": "flac",
    "audio/webm": "webm"
  };

  function baseContentType(contentType) {
    return String(contentType || "").toLowerCase().split(";")[0].trim();
  }

  function hostnameOf(urlString) {
    try {
      return new URL(urlString).hostname.toLowerCase();
    } catch {
      return "";
    }
  }

  // Accepts "example.com", "https://example.com/path", "*.example.com".
  function normalizeHost(value) {
    let host = String(value || "").trim().toLowerCase();
    if (!host) return "";
    host = host.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
    host = host.split(/[/?#]/)[0];
    host = host.replace(/:\d+$/, "");
    host = host.replace(/^\*\./, "").replace(/^\.+|\.+$/g, "");
    return host;
  }

  function hostMatches(hostname, pattern) {
    const value = normalizeHost(pattern);
    if (!hostname || !value) return false;
    return hostname === value || hostname.endsWith(`.${value}`);
  }

  function sanitizeFilename(name) {
    let cleaned = String(name || "")
      .split(/[\\/]/)
      .pop()
      .replace(/[<>:"|?*\u0000-\u001f]/g, "_")
      .trim()
      .replace(/^\.+/, "")
      .replace(/[. ]+$/, "");
    // Windows reserved device names.
    if (/^(con|prn|aux|nul|com\d|lpt\d)(\.|$)/i.test(cleaned)) cleaned = `_${cleaned}`;
    return cleaned.slice(0, 180) || "media-download";
  }

  function extensionForContentType(contentType) {
    return CONTENT_TYPE_EXTENSIONS[baseContentType(contentType)] || "";
  }

  function hasExtension(name) {
    return /\.[a-z0-9]{2,5}$/i.test(name);
  }

  function withExtension(name, contentType) {
    if (hasExtension(name)) return name;
    const ext = extensionForContentType(contentType);
    return ext ? `${name}.${ext}` : name;
  }

  function filenameFromContentDisposition(header) {
    const value = String(header || "");
    const star = value.match(/filename\*\s*=\s*([^']*)'[^']*'([^;]+)/i);
    if (star) {
      try {
        return decodeURIComponent(star[2].trim().replace(/^"|"$/g, ""));
      } catch {
        /* fall through to plain filename */
      }
    }
    const plain = value.match(/filename\s*=\s*("([^"]*)"|[^;]+)/i);
    if (plain) return (plain[2] ?? plain[1]).trim();
    return "";
  }

  function filenameFromUrl(urlString, contentType = "") {
    let name = "";
    try {
      name = decodeURIComponent(new URL(urlString).pathname.split("/").pop() || "");
    } catch {
      name = "";
    }
    name = sanitizeFilename(name || "media-download");
    return sanitizeFilename(withExtension(name, contentType));
  }

  function classify(urlString, contentType) {
    const type = baseContentType(contentType);
    if (PLAYLIST_EXT.test(urlString) || type.includes("mpegurl") || type.includes("dash+xml")) {
      return "playlist";
    }
    if (type.startsWith("audio/")) return "audio";
    if (type.startsWith("video/")) return "video";
    if (AUDIO_EXT.test(urlString)) return "audio";
    if (MEDIA_EXT.test(urlString)) return "video";
    return "unknown";
  }

  function isDirectMedia(urlString, contentType) {
    return classify(urlString, contentType) !== "unknown";
  }

  // Players fetch media in ranges; Content-Length is then the size of one
  // chunk. The full size is the total in "Content-Range: bytes 0-99/12345".
  function totalSizeFromHeaders(contentRange, contentLength, statusCode) {
    const range = String(contentRange || "").match(/\/\s*(\d+)\s*$/);
    if (range) return Number(range[1]);
    if (statusCode === 206) return 0;
    const length = Number(contentLength || 0);
    return Number.isFinite(length) && length > 0 ? length : 0;
  }

  // Every URL involved (the media itself, the page, the frame or initiator)
  // must pass the blocklist; the allowlist must match at least one of them.
  function isAllowed(urls, settings) {
    const hosts = (Array.isArray(urls) ? urls : [urls]).map(hostnameOf).filter(Boolean);
    if (!hosts.length) return false;
    const blocked = settings.blockedHosts || [];
    if (hosts.some((host) => blocked.some((pattern) => hostMatches(host, pattern)))) {
      return false;
    }
    const allowlist = (settings.allowlistHosts || []).map(normalizeHost).filter(Boolean);
    if (allowlist.length && !hosts.some((host) => allowlist.some((pattern) => hostMatches(host, pattern)))) {
      return false;
    }
    return true;
  }

  function normalizeHostList(list) {
    const seen = new Set();
    for (const entry of Array.isArray(list) ? list : []) {
      const host = normalizeHost(entry);
      if (host) seen.add(host);
    }
    return [...seen];
  }

  function normalizeSettings(input) {
    const raw = { ...DEFAULT_SETTINGS, ...(input || {}) };
    const max = Math.round(Number(raw.maxCandidates));
    const template = String(raw.filenameTemplate ?? "").trim().slice(0, 200);
    const warnMB = Math.round(Number(raw.largeFileWarningMB));
    return {
      saveAs: Boolean(raw.saveAs),
      showPlaylists: Boolean(raw.showPlaylists),
      folderName: sanitizeFilename(String(raw.folderName || "").trim() || DEFAULT_SETTINGS.folderName).slice(0, 80),
      maxCandidates: Number.isFinite(max) ? Math.min(100, Math.max(5, max)) : DEFAULT_SETTINGS.maxCandidates,
      blockedHosts: normalizeHostList(raw.blockedHosts),
      allowlistHosts: normalizeHostList(raw.allowlistHosts),
      filenameTemplate: template || DEFAULT_SETTINGS.filenameTemplate,
      language: LANGUAGE_CODES.includes(raw.language) ? raw.language : DEFAULT_SETTINGS.language,
      largeFileWarningMB: Number.isFinite(warnMB)
        ? Math.min(100000, Math.max(0, warnMB))
        : DEFAULT_SETTINGS.largeFileWarningMB
    };
  }

  /**
   * Combine the user's settings with policy set by an administrator
   * (chrome.storage.managed). Managed values win; managed blocked hosts are
   * added to the user's list so they cannot be removed.
   */
  function mergeManaged(local, managed) {
    const policy = managed && typeof managed === "object" ? managed : {};
    const managedKeys = SETTING_KEYS.filter((key) => policy[key] !== undefined);
    const merged = { ...normalizeSettings(local) };
    for (const key of managedKeys) {
      merged[key] =
        key === "blockedHosts"
          ? [...(Array.isArray(policy.blockedHosts) ? policy.blockedHosts : []), ...merged.blockedHosts]
          : policy[key];
    }
    return { settings: normalizeSettings(merged), managedKeys };
  }

  function exportSettings(settings, version = "") {
    return {
      app: "harmony-media-saver",
      version,
      exportedAt: new Date().toISOString(),
      settings: normalizeSettings(settings)
    };
  }

  // Accepts an exported file or a bare settings object. Throws on bad input.
  function parseImportedSettings(text) {
    let data;
    try {
      data = JSON.parse(String(text));
    } catch {
      throw new Error("The file is not valid JSON.");
    }
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new Error("The file does not contain settings.");
    }
    const settings = data.app === "harmony-media-saver" ? data.settings : data;
    if (!settings || typeof settings !== "object" || !SETTING_KEYS.some((key) => key in settings)) {
      throw new Error("The file does not contain Harmony Media Saver settings.");
    }
    const picked = {};
    for (const key of SETTING_KEYS) if (key in settings) picked[key] = settings[key];
    return normalizeSettings(picked);
  }

  function localDate(date) {
    const pad = (n) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  /**
   * Turn a template such as "{site}/{title}/{filename}" into a safe relative
   * path. Each folder is sanitized on its own; empty folders are dropped and
   * the file always keeps its extension.
   */
  function buildRelativePath(template, info = {}, date = new Date()) {
    const filename = sanitizeFilename(info.filename || "media-download");
    const dot = filename.lastIndexOf(".");
    const name = dot > 0 ? filename.slice(0, dot) : filename;
    const ext = dot > 0 ? filename.slice(dot + 1) : "";
    const values = {
      filename,
      name,
      ext,
      site: hostnameOf(info.pageUrl || "").replace(/^www\./, "") || "unknown-site",
      title: String(info.pageTitle || "").trim().slice(0, 80) || "untitled",
      date: localDate(date),
      kind: info.kind || "media"
    };

    const segments = String(template || DEFAULT_SETTINGS.filenameTemplate)
      .split(/[\\/]+/)
      .map((segment) =>
        segment.replace(/\{(\w+)\}/g, (match, token) =>
          TEMPLATE_TOKENS.includes(token) ? values[token] : match
        )
      )
      .map((segment) => segment.trim())
      .filter((segment) => segment && segment !== "." && segment !== "..")
      .map((segment) => sanitizeFilename(segment.replace(/[\\/]/g, "-")).slice(0, 80));

    const folders = segments.slice(0, -1).slice(0, 4);
    let file = segments.at(-1) || filename;
    if (ext && !file.toLowerCase().endsWith(`.${ext.toLowerCase()}`)) file = `${file}.${ext}`;
    return [...folders, sanitizeFilename(file)].join("/");
  }

  // URL patterns for the context menu so it only shows on media links.
  function mediaLinkPatterns() {
    return [...VIDEO_EXTENSIONS, ...AUDIO_EXTENSIONS].flatMap((ext) => [
      `*://*/*.${ext}*`,
      `*://*/*.${ext.toUpperCase()}*`
    ]);
  }

  // Size in bytes above which the user is asked to confirm, or 0 for never.
  function largeFileLimit(settings) {
    const mb = Number(settings?.largeFileWarningMB || 0);
    return mb > 0 ? mb * 1024 * 1024 : 0;
  }

  function formatBytes(bytes) {
    if (!bytes || bytes < 0) return "";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  const api = {
    AUDIO_EXT,
    MEDIA_EXT,
    PLAYLIST_EXT,
    STREAMING_CDN_HOSTS,
    DEFAULT_BLOCKED_HOSTS,
    DEFAULT_SETTINGS,
    LANGUAGE_CODES,
    SETTING_KEYS,
    TEMPLATE_TOKENS,
    mergeManaged,
    exportSettings,
    parseImportedSettings,
    buildRelativePath,
    hostnameOf,
    normalizeHost,
    hostMatches,
    sanitizeFilename,
    extensionForContentType,
    filenameFromContentDisposition,
    filenameFromUrl,
    withExtension,
    classify,
    isDirectMedia,
    totalSizeFromHeaders,
    isAllowed,
    normalizeSettings,
    mediaLinkPatterns,
    largeFileLimit,
    formatBytes,
    escapeHtml
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.HarmonyShared = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
