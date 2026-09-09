// Talks to the DeepSeek API. Runs in the extension's background service
// worker so the request isn't subject to the page's CSP and the API key
// never touches the page context.

const DEFAULTS = {
  apiKey: "",
  translateModel: "deepseek-chat",
  explainModel: "deepseek-reasoner",
  targetLang: "简体中文",
  enabled: true,
};

// deepseek-reasoner ignores sampling params, so temperature is only sent for
// the chat models. 1.3 is DeepSeek's documented pick for translation.
const TEMPERATURES = { translate: 1.3, explain: 1.0 };

async function getSettings() {
  const stored = await chrome.storage.local.get(Object.keys(DEFAULTS));
  return { ...DEFAULTS, ...stored };
}

function buildMessages(mode, text, quotedText, targetLang) {
  if (mode === "explain") {
    const system =
      `你是一个帮助读者理解社交媒体推文的助手。请用${targetLang}解释用户给出的推文。` +
      "先用一句话说明这条推文在讲什么，然后解释其中的术语、缩写、人名、机构、背景事件和言外之意。" +
      "简洁清楚，可以用简短的分点，不要逐句翻译，不要使用 Markdown 标题或加粗符号。";
    const user = quotedText
      ? `推文：\n${text}\n\n它引用的推文（背景信息）：\n${quotedText}`
      : `推文：\n${text}`;
    return [
      { role: "system", content: system },
      { role: "user", content: user },
    ];
  }

  return [
    {
      role: "system",
      content:
        `你是一个专业的推文翻译助手。请把用户提供的推文文本翻译成${targetLang}。` +
        "只输出翻译结果本身，不要加任何解释、引号或前缀。" +
        "话题标签(#xxx)和提及(@xxx)保留原样，可以自然地融入译文中。" +
        "保留原文的换行结构。",
    },
    { role: "user", content: text },
  ];
}

async function callDeepSeek(mode, text, quotedText, targetLang) {
  const settings = await getSettings();
  if (!settings.apiKey) {
    return { ok: false, error: "还没有配置 DeepSeek API Key，请点击插件图标进入设置填写。" };
  }

  const model = mode === "explain" ? settings.explainModel : settings.translateModel;
  const body = {
    model,
    stream: false,
    messages: buildMessages(mode, text, quotedText, targetLang || settings.targetLang),
  };
  if (model !== "deepseek-reasoner") {
    body.temperature = TEMPERATURES[mode] ?? 1.0;
  }

  let resp;
  try {
    resp = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    return { ok: false, error: `网络请求失败：${String(e)}` };
  }

  if (!resp.ok) {
    let detail = "";
    try {
      detail = (await resp.text()).slice(0, 200);
    } catch (_) {}
    return { ok: false, error: `DeepSeek API 返回错误 (${resp.status})：${detail}` };
  }

  let data;
  try {
    data = await resp.json();
  } catch (e) {
    return { ok: false, error: "无法解析 DeepSeek 返回的数据。" };
  }

  const content = data?.choices?.[0]?.message?.content?.trim();
  if (!content) return { ok: false, error: "DeepSeek 返回了空结果。" };
  return { ok: true, content };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "DEEPSEEK_RUN") {
    (async () => {
      sendResponse(
        await callDeepSeek(msg.mode, msg.text, msg.quotedText, msg.targetLang)
      );
    })();
    return true; // keep the message channel open for the async response
  }

  if (msg?.type === "DEEPSEEK_TEST_KEY") {
    (async () => {
      sendResponse(await callDeepSeek("translate", "Hello, world!", "", "简体中文"));
    })();
    return true;
  }
});
