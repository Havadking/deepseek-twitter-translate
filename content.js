// Adds its own "DeepSeek 翻译" / "DeepSeek 解释" buttons under each tweet.
// X's native translate link is left untouched.

(() => {
  const DEFAULTS = {
    enabled: true,
    targetLang: "简体中文",
    showTranslate: true,
    showExplain: true,
  };

  const LABELS = {
    translate: {
      idle: "DeepSeek 翻译",
      loading: "翻译中…",
      hide: "隐藏译文",
      show: "显示译文",
      caption: "已使用 DeepSeek 翻译",
    },
    explain: {
      idle: "DeepSeek 解释",
      loading: "解释中…",
      hide: "隐藏解释",
      show: "显示解释",
      caption: "DeepSeek 解释",
    },
  };

  const MODES = ["translate", "explain"];

  const SHOW_MORE_TEXTS = new Set([
    "显示更多",
    "顯示更多",
    "Show more",
    "もっと見る",
    "더 보기",
    "Mostrar más",
    "Afficher plus",
  ]);

  let settings = { ...DEFAULTS };
  const uiMap = new WeakMap(); // tweetTextEl -> ui
  let accentColor = null;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // ---------------------------------------------------------------- settings

  chrome.storage.local.get(Object.keys(DEFAULTS)).then((s) => {
    settings = { ...DEFAULTS, ...s };
    scan();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    for (const [key, change] of Object.entries(changes)) {
      if (key in DEFAULTS) settings[key] = change.newValue;
    }
    refreshVisibility();
    scan();
  });

  // ------------------------------------------------------------ text helpers

  function extractText(el) {
    let out = "";
    el.childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        out += node.textContent;
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        out += node.tagName === "IMG" ? node.getAttribute("alt") || "" : node.textContent;
      }
    });
    return out.trim();
  }

  // Text of the quoted tweet inside the same article, used as extra context.
  function extractQuotedText(tweetTextEl) {
    const article = tweetTextEl.closest("article");
    if (!article) return "";
    const all = [...article.querySelectorAll('[data-testid="tweetText"]')];
    const idx = all.indexOf(tweetTextEl);
    const quoted = idx >= 0 ? all[idx + 1] : null;
    return quoted ? extractText(quoted) : "";
  }

  function getAccentColor(tweetTextEl) {
    if (accentColor) return accentColor;
    const link = tweetTextEl.querySelector("a");
    accentColor = link ? getComputedStyle(link).color : "rgb(29, 155, 240)";
    return accentColor;
  }

  // ------------------------------------------------------------ auto expand

  function findShowMore(tweetTextEl) {
    const scope = tweetTextEl.parentElement;
    if (!scope) return null;
    const direct = scope.querySelector('[data-testid="tweet-text-show-more-link"]');
    if (direct) return direct;
    for (const el of scope.querySelectorAll(
      'div[role="button"], button, span[role="button"], a[role="link"]'
    )) {
      if (SHOW_MORE_TEXTS.has((el.innerText || "").trim())) return el;
    }
    return null;
  }

  async function waitForPrimaryTweetText() {
    const deadline = Date.now() + 4000;
    while (Date.now() < deadline) {
      const el = document.querySelector('article[data-testid="tweet"] [data-testid="tweetText"]');
      if (el && !findShowMore(el)) return el;
      await sleep(150);
    }
    return document.querySelector('article[data-testid="tweet"] [data-testid="tweetText"]');
  }

  // Returns the element holding the full text — either the original one after
  // it expanded in place, or the tweet's text on the detail page if clicking
  // "show more" navigated there. Null if the tweet vanished entirely.
  async function ensureExpanded(tweetTextEl) {
    const more = findShowMore(tweetTextEl);
    if (!more) return tweetTextEl;

    const lengthBefore = tweetTextEl.textContent.length;
    more.click();

    const deadline = Date.now() + 3000;
    while (Date.now() < deadline) {
      await sleep(120);
      if (!tweetTextEl.isConnected) return waitForPrimaryTweetText();
      if (!findShowMore(tweetTextEl) || tweetTextEl.textContent.length > lengthBefore) {
        return tweetTextEl;
      }
    }
    return tweetTextEl.isConnected ? tweetTextEl : waitForPrimaryTweetText();
  }

  // -------------------------------------------------------------------- UI

  function makeButton(mode, tweetTextEl) {
    const btn = document.createElement("span");
    btn.setAttribute("role", "button");
    btn.setAttribute("tabindex", "0");
    btn.dataset.deepseekBtn = mode;
    btn.textContent = LABELS[mode].idle;
    btn.style.cssText = `cursor:pointer;font-size:14px;line-height:18px;color:${getAccentColor(
      tweetTextEl
    )};`;
    btn.addEventListener("mouseenter", () => (btn.style.textDecoration = "underline"));
    btn.addEventListener("mouseleave", () => (btn.style.textDecoration = "none"));
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      runAction(mode, tweetTextEl);
    });
    return btn;
  }

  function ensureUI(tweetTextEl) {
    const existing = uiMap.get(tweetTextEl);
    if (existing && existing.container.isConnected) return existing;

    const container = document.createElement("div");
    container.setAttribute("data-deepseek-ui", "1");
    container.style.cssText = "margin-top:4px;";
    container.addEventListener("click", (e) => e.stopPropagation());

    const slots = {};
    for (const mode of MODES) {
      const slot = document.createElement("div");
      slot.style.display = "none";
      container.appendChild(slot);
      slots[mode] = slot;
    }

    const row = document.createElement("div");
    row.style.cssText = "display:flex;gap:16px;flex-wrap:wrap;margin-top:2px;";
    const buttons = {};
    for (const mode of MODES) {
      buttons[mode] = makeButton(mode, tweetTextEl);
      row.appendChild(buttons[mode]);
    }
    container.appendChild(row);

    tweetTextEl.insertAdjacentElement("afterend", container);

    const ui = { container, slots, buttons, cache: {} };
    uiMap.set(tweetTextEl, ui);
    applyVisibility(ui);
    return ui;
  }

  function applyVisibility(ui) {
    ui.container.style.display = settings.enabled ? "" : "none";
    ui.buttons.translate.style.display = settings.showTranslate === false ? "none" : "";
    ui.buttons.explain.style.display = settings.showExplain === false ? "none" : "";
  }

  function refreshVisibility() {
    document.querySelectorAll("[data-deepseek-ui]").forEach((container) => {
      container.style.display = settings.enabled ? "" : "none";
      container.querySelectorAll("[data-deepseek-btn]").forEach((btn) => {
        const mode = btn.dataset.deepseekBtn;
        const on = mode === "translate" ? settings.showTranslate : settings.showExplain;
        btn.style.display = on === false ? "none" : "";
      });
    });
  }

  function renderResult(ui, mode, text, tweetTextEl) {
    const slot = ui.slots[mode];
    slot.textContent = "";
    slot.style.display = "";

    const caption = document.createElement("div");
    caption.textContent = LABELS[mode].caption;
    caption.style.cssText =
      "font-size:13px;line-height:16px;color:rgb(113,118,123);margin-bottom:2px;";

    const body = document.createElement("div");
    body.textContent = text;
    body.style.cssText = `font-size:15px;line-height:20px;color:${
      getComputedStyle(tweetTextEl).color
    };white-space:pre-wrap;word-wrap:break-word;margin-bottom:4px;`;

    slot.appendChild(caption);
    slot.appendChild(body);
  }

  function renderError(ui, mode, message) {
    const slot = ui.slots[mode];
    slot.textContent = `DeepSeek ${mode === "translate" ? "翻译" : "解释"}失败：${message}`;
    slot.style.display = "";
    slot.style.cssText =
      "font-size:13px;line-height:16px;color:rgb(244,33,46);white-space:pre-wrap;margin-bottom:4px;";
  }

  function setLabel(ui, mode, text) {
    ui.buttons[mode].textContent = text;
  }

  // ---------------------------------------------------------------- actions

  async function runAction(mode, tweetTextEl) {
    let ui = ensureUI(tweetTextEl);

    if (ui.cache[mode]) {
      const showing = ui.slots[mode].style.display !== "none";
      ui.slots[mode].style.display = showing ? "none" : "";
      setLabel(ui, mode, showing ? LABELS[mode].show : LABELS[mode].hide);
      return;
    }

    setLabel(ui, mode, LABELS[mode].loading);

    const expandedEl = await ensureExpanded(tweetTextEl);
    if (!expandedEl) {
      setLabel(ui, mode, LABELS[mode].idle);
      renderError(ui, mode, "推文已从页面上消失，无法读取内容。");
      return;
    }
    if (expandedEl !== tweetTextEl) {
      tweetTextEl = expandedEl;
      ui = ensureUI(tweetTextEl);
      if (ui.cache[mode]) return;
      setLabel(ui, mode, LABELS[mode].loading);
    }

    const text = extractText(tweetTextEl);
    if (!text) {
      setLabel(ui, mode, LABELS[mode].idle);
      return;
    }

    const resp = await chrome.runtime.sendMessage({
      type: "DEEPSEEK_RUN",
      mode,
      text,
      quotedText: extractQuotedText(tweetTextEl),
      targetLang: settings.targetLang,
    });

    if (!resp || !resp.ok) {
      setLabel(ui, mode, LABELS[mode].idle);
      renderError(ui, mode, resp?.error || "未知错误");
      return;
    }

    renderResult(ui, mode, resp.content, tweetTextEl);
    ui.cache[mode] = true;
    setLabel(ui, mode, LABELS[mode].hide);
  }

  // --------------------------------------------------------- scan & observe

  function scan() {
    if (!settings.enabled) return;
    document.querySelectorAll('article [data-testid="tweetText"]').forEach((el) => {
      // Skip the nested text of a quoted tweet — it is passed to "解释" as
      // context instead of getting its own pair of buttons.
      if (el.closest('div[role="link"]')) return;
      const next = el.nextElementSibling;
      if (next?.hasAttribute?.("data-deepseek-ui")) return;
      ensureUI(el);
    });
  }

  let scanScheduled = false;
  new MutationObserver(() => {
    if (scanScheduled) return;
    scanScheduled = true;
    setTimeout(() => {
      scanScheduled = false;
      scan();
    }, 200);
  }).observe(document.body, { childList: true, subtree: true });

  scan();
})();
