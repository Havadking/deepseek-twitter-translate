const PRESET_LANGS = ["简体中文", "繁體中文", "English", "日本語", "한국어"];

const els = {
  enabled: document.getElementById("enabled"),
  apiKey: document.getElementById("apiKey"),
  targetLang: document.getElementById("targetLang"),
  targetLangCustom: document.getElementById("targetLangCustom"),
  showTranslate: document.getElementById("showTranslate"),
  translateModel: document.getElementById("translateModel"),
  showExplain: document.getElementById("showExplain"),
  explainModel: document.getElementById("explainModel"),
  save: document.getElementById("save"),
  test: document.getElementById("test"),
  status: document.getElementById("status"),
};

function setStatus(text, kind) {
  els.status.textContent = text;
  els.status.className = kind || "";
}

function applyTargetLangToUI(value) {
  if (PRESET_LANGS.includes(value)) {
    els.targetLang.value = value;
    els.targetLangCustom.style.display = "none";
    els.targetLangCustom.value = "";
  } else {
    els.targetLang.value = "__custom__";
    els.targetLangCustom.style.display = "";
    els.targetLangCustom.value = value || "";
  }
}

function currentTargetLang() {
  if (els.targetLang.value === "__custom__") {
    return els.targetLangCustom.value.trim() || "简体中文";
  }
  return els.targetLang.value;
}

function collect() {
  return {
    enabled: els.enabled.checked,
    apiKey: els.apiKey.value.trim(),
    targetLang: currentTargetLang(),
    showTranslate: els.showTranslate.checked,
    translateModel: els.translateModel.value,
    showExplain: els.showExplain.checked,
    explainModel: els.explainModel.value,
  };
}

async function load() {
  const s = await chrome.storage.local.get([
    "enabled",
    "apiKey",
    "targetLang",
    "showTranslate",
    "translateModel",
    "showExplain",
    "explainModel",
  ]);
  els.enabled.checked = s.enabled !== false;
  els.apiKey.value = s.apiKey || "";
  els.showTranslate.checked = s.showTranslate !== false;
  els.showExplain.checked = s.showExplain !== false;
  els.translateModel.value = s.translateModel || "deepseek-chat";
  els.explainModel.value = s.explainModel || "deepseek-reasoner";
  applyTargetLangToUI(s.targetLang || "简体中文");
}

els.targetLang.addEventListener("change", () => {
  els.targetLangCustom.style.display =
    els.targetLang.value === "__custom__" ? "" : "none";
});

els.save.addEventListener("click", async () => {
  await chrome.storage.local.set(collect());
  setStatus("已保存。", "ok");
});

els.test.addEventListener("click", async () => {
  const values = collect();
  if (!values.apiKey) {
    setStatus("请先填写 API Key。", "err");
    return;
  }
  await chrome.storage.local.set(values);
  setStatus("正在测试…", "");
  const resp = await chrome.runtime.sendMessage({ type: "DEEPSEEK_TEST_KEY" });
  if (resp?.ok) {
    setStatus(`连接成功，示例翻译结果：${resp.content}`, "ok");
  } else {
    setStatus(resp?.error || "测试失败。", "err");
  }
});

load();
