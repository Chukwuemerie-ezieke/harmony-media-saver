const { buildRelativePath, exportSettings, parseImportedSettings } = globalThis.HarmonyShared;
const { LANGUAGES, resolveLanguage, translator, applyTranslations } = globalThis.HarmonyI18n;

const form = document.querySelector("#settingsForm");
const saveStatus = document.querySelector("#saveStatus");
const backupStatus = document.querySelector("#backupStatus");
const historyList = document.querySelector("#historyList");
const templatePreview = document.querySelector("#templatePreview");
const importFile = document.querySelector("#importFile");

let defaults = null;
let version = "";
let managedKeys = [];
let t = translator("en");

function lines(value) {
  return String(value || "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function fillLanguageOptions() {
  const select = form.language;
  const current = select.value;
  select.replaceChildren();
  for (const { code, name } of [{ code: "auto", name: t("languageAuto") }, ...LANGUAGES]) {
    select.appendChild(new Option(name, code));
  }
  if (current) select.value = current;
}

function setLanguage(code) {
  const language = resolveLanguage(code, navigator.language);
  t = translator(language);
  document.documentElement.lang = language;
  applyTranslations(document, t);
  fillLanguageOptions();
  updatePreview();
  void loadHistory();
}

function readForm() {
  return {
    language: form.language.value,
    folderName: form.folderName.value,
    filenameTemplate: form.filenameTemplate.value,
    saveAs: form.saveAs.checked,
    showPlaylists: form.showPlaylists.checked,
    maxCandidates: Number(form.maxCandidates.value || 50),
    blockedHosts: lines(form.blockedHosts.value),
    allowlistHosts: lines(form.allowlistHosts.value)
  };
}

function fillForm(settings) {
  form.language.value = settings.language;
  form.folderName.value = settings.folderName;
  form.filenameTemplate.value = settings.filenameTemplate;
  form.saveAs.checked = Boolean(settings.saveAs);
  form.showPlaylists.checked = Boolean(settings.showPlaylists);
  form.maxCandidates.value = settings.maxCandidates;
  form.blockedHosts.value = (settings.blockedHosts || []).join("\n");
  form.allowlistHosts.value = (settings.allowlistHosts || []).join("\n");
  updatePreview();
}

// Fields an administrator has set are shown but locked. Managed blocked
// hosts are always added on top, so the user may still add more.
function applyManagedLocks() {
  document.querySelector("#managedNotice").hidden = managedKeys.length === 0;
  for (const key of managedKeys) {
    if (key === "blockedHosts") continue;
    const field = form.elements[key];
    if (!field) continue;
    field.disabled = true;
    field.closest("label")?.classList.add("managed");
  }
}

function updatePreview() {
  const path = buildRelativePath(form.filenameTemplate.value, {
    filename: "Week 3 Lecture.mp4",
    pageUrl: "https://www.learn.yourschool.edu.ng/course/view.php?id=12",
    pageTitle: "Biology SS2",
    kind: "video"
  });
  const folder = form.folderName.value.trim() || "HarmonyMedia";
  templatePreview.textContent = t("preview", { path: `${folder}/${path}` });
}

async function loadSettings() {
  const result = await chrome.runtime.sendMessage({ type: "GET_SETTINGS" });
  defaults = result.defaults;
  version = result.version || "";
  managedKeys = result.managedKeys || [];
  fillLanguageOptions();
  fillForm(result.settings);
  setLanguage(result.settings.language);
  form.language.value = result.settings.language;
  applyManagedLocks();
}

async function loadHistory() {
  const result = await chrome.runtime.sendMessage({ type: "GET_HISTORY" });
  const history = result.history || [];
  historyList.replaceChildren();
  if (!history.length) {
    const empty = document.createElement("li");
    empty.textContent = t("noHistory");
    historyList.appendChild(empty);
    return;
  }
  for (const item of history) {
    const li = document.createElement("li");
    const name = document.createElement("strong");
    name.textContent = item.path || item.filename;
    const when = new Date(item.downloadedAt).toLocaleString();
    const via = item.source === "context-menu" ? ` · ${t("viaRightClick")}` : "";
    li.append(name, ` · ${when}${via}`, document.createElement("br"), item.url);
    historyList.appendChild(li);
  }
}

async function saveSettings(settings) {
  const result = await chrome.runtime.sendMessage({ type: "SAVE_SETTINGS", settings });
  if (!result?.ok) throw new Error(result?.error || t("settingsFailed"));
  managedKeys = result.managedKeys || managedKeys;
  fillForm(result.settings);
  setLanguage(result.settings.language);
  form.language.value = result.settings.language;
  return result.settings;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await saveSettings(readForm());
    saveStatus.textContent = t("settingsSaved");
  } catch (error) {
    saveStatus.textContent = error.message || t("settingsFailed");
  }
});

form.filenameTemplate.addEventListener("input", updatePreview);
form.folderName.addEventListener("input", updatePreview);
form.language.addEventListener("change", () => {
  const chosen = form.language.value;
  setLanguage(chosen);
  form.language.value = chosen;
});

document.querySelector("#resetButton").addEventListener("click", () => {
  if (!defaults) return;
  fillForm(defaults);
  setLanguage(defaults.language);
  form.language.value = defaults.language;
  saveStatus.textContent = t("defaultsRestored");
});

document.querySelector("#clearHistoryButton").addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "CLEAR_HISTORY" });
  await loadHistory();
});

document.querySelector("#exportButton").addEventListener("click", async () => {
  const { settings } = await chrome.runtime.sendMessage({ type: "GET_SETTINGS" });
  const blob = new Blob([JSON.stringify(exportSettings(settings, version), null, 2)], {
    type: "application/json"
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "harmony-media-saver-settings.json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
});

document.querySelector("#importButton").addEventListener("click", () => importFile.click());

importFile.addEventListener("change", async () => {
  const file = importFile.files?.[0];
  importFile.value = "";
  if (!file) return;
  try {
    const settings = parseImportedSettings(await file.text());
    await saveSettings(settings);
    backupStatus.textContent = t("imported");
  } catch (error) {
    backupStatus.textContent = t("importFailed", { error: error.message || String(error) });
  }
});

loadSettings();
