# DeepSeek 翻译 for X / Twitter

给 X（Twitter）的每条推文加上两个自己的按钮，用 DeepSeek 的 API 来处理，不动 X 自带的翻译功能：

- **DeepSeek 翻译** — 把推文翻译成你设定的语言
- **DeepSeek 解释** — 解释推文在讲什么，包括术语、缩写、人物和背景（引用的推文会作为背景一起发给模型）

两个按钮可以分别配置模型（默认翻译用 `deepseek-chat`，解释用 `deepseek-reasoner`），也可以分别隐藏。点击时如果推文被折叠（"显示更多"），会先自动展开拿到全文再处理。结果出来后再点一次按钮可以收起，不会重复请求。

## 安装（开发者模式加载）

1. 打开 Chrome，访问 `chrome://extensions`
2. 右上角打开"开发者模式"
3. 点击"加载已解压的扩展程序"，选择本文件夹
4. 点击工具栏里的插件图标 → "打开完整设置"
5. 填入你的 DeepSeek API Key（在 [platform.deepseek.com/api_keys](https://platform.deepseek.com/api_keys) 申请），选好模型和输出语言，点"测试连接"确认可用，再点"保存"

## 隐私说明

- API Key 只存在本地浏览器的 `chrome.storage.local` 里，不会同步到任何地方，也不会发给除 `api.deepseek.com` 以外的任何服务器。
- 只有在你点击按钮时，那一条推文的文本才会发送给 DeepSeek。

## 已知限制

- 引用推文（quote tweet）里嵌套的那条推文不会单独长出按钮，它只作为"解释"的背景信息传给模型。
- 长推文的"显示更多"在某些情况下会跳转到推文详情页，插件会在跳转后的页面上继续完成这次翻译/解释。
- 只处理推文正文，个人资料简介等其他位置未处理。
