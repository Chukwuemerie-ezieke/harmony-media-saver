const form = document.querySelector("#settingsForm");
const saveStatus = document.querySelector("#saveStatus");
const historyList = document.querySelector("#historyList");
let defaults = null;

function lines(value) {
  return String(value || "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function fillForm(settings) {
  form.folderName.value = settings.folderName;
  form.saveAs.checked = Boolean(settings.saveAs);
  form.showPlaylists.checked = Boolean(settings.showPlaylists);
  form.maxCandidates.value = settings.maxCandidates;
  form.blockedHosts.value = (settings.blockedHosts || []).join("\n");
  form.allowlistHosts.value = (settings.allowlistHosts || []).join("\n");
}

async function loadSettings() {
  const result = await chrome.runtime.sendMessage({ type: "GET_SETTINGS" });
  defaults = result.defaults;
  fillForm(result.settings);
}

async function loadHistory() {
  const result = await chrome.runtime.sendMessage({ type: "GET_HISTORY" });
  const history = result.history || [];
  historyList.replaceChildren();
  if (!history.length) {
    const empty = document.createElement("li");
    empty.textContent = "No local history yet.";
    historyList.appendChild(empty);
    return;
  }
  for (const item of history) {
    const li = document.createElement("li");
    const name = document.createElement("strong");
    name.textContent = item.filename;
    const when = new Date(item.downloadedAt).toLocaleString();
    const via = item.source === "context-menu" ? " · right-click" : "";
    li.append(name, ` · ${when}${via}`, document.createElement("br"), item.url);
    historyList.appendChild(li);
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const result = await chrome.runtime.sendMessage({
    type: "SAVE_SETTINGS",
    settings: {
      folderName: form.folderName.value,
      saveAs: form.saveAs.checked,
      showPlaylists: form.showPlaylists.checked,
      maxCandidates: Number(form.maxCandidates.value || 50),
      blockedHosts: lines(form.blockedHosts.value),
      allowlistHosts: lines(form.allowlistHosts.value)
    }
  });
  if (result?.ok) {
    fillForm(result.settings);
    saveStatus.textContent = "Settings saved on this device.";
  } else {
    saveStatus.textContent = result?.error || "Could not save settings.";
  }
});

document.querySelector("#resetButton").addEventListener("click", () => {
  if (!defaults) return;
  fillForm(defaults);
  saveStatus.textContent = "Defaults restored in the form. Click Save settings to apply.";
});

document.querySelector("#clearHistoryButton").addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "CLEAR_HISTORY" });
  await loadHistory();
});

loadSettings();
loadHistory();
