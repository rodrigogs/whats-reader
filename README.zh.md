# <h1 align="center">WhatsApp 备份阅读器</h1>

<p align="center">
  <img src="src/lib/assets/favicon.svg" width="100" height="100" alt="WhatsApp 备份阅读器" />
</p>

<p align="center">
  <strong>离线浏览您的 WhatsApp 导出数据。您的数据保留在设备上。</strong>
</p>

<p align="center">
  <a href="README.md">English</a> •
  <a href="README.pt.md">Português</a> •
  <a href="README.es.md">Español</a> •
  <a href="README.fr.md">Français</a> •
  <a href="README.de.md">Deutsch</a> •
  <a href="README.it.md">Italiano</a> •
  <a href="README.nl.md">Nederlands</a> •
  <a href="README.ja.md">日本語</a> •
  <strong>中文</strong> •
  <a href="README.ru.md">Русский</a>
</p>

---

## 功能介绍

拖放从 WhatsApp 导出的 `.zip` 文件，浏览您的消息、照片和语音备忘录。适用于大型聊天（已测试超过 10,000 条消息）。

语音消息可以使用通过 WebGPU 在浏览器中运行的 [Whisper](https://openai.com/research/whisper) 进行转录。无需服务器，无需 API 密钥。

## 主要特性

- **语音转录**：使用 Whisper 转录音频（本地运行，支持 12 种以上语言）
- **搜索**：在消息和转录中进行全文搜索
- **书签**：保存带有笔记的消息，导出/导入为 JSON
- **视角模式**：以任何参与者的身份查看聊天
- **统计**：消息计数、活动图表、时间线
- **暗黑模式**：跟随系统或手动切换（保存偏好）
- **多语言界面**：英语、葡萄牙语、西班牙语、法语、德语、意大利语、荷兰语、日语、中文、俄语
- **桌面应用**：通过 Electron 支持 macOS、Windows、Linux

## 快速开始

### 前置要求

您需要安装 [Node.js](https://nodejs.org/)（版本 18 或更高）。

```bash
node --version
```

### 运行应用

```bash
npm install
npm run dev
```

在浏览器中打开 [localhost:5173](http://localhost:5173)，然后拖放您的 WhatsApp `.zip` 文件。

### 桌面应用（可选）

```bash
npm run electron:dev    # 在开发模式下运行
npm run electron:build  # 为您的操作系统创建安装程序
```

## 如何从 WhatsApp 导出

### iPhone
1. 打开 WhatsApp 并进入任何聊天
2. 点击屏幕顶部的联系人或群组名称
3. 向下滚动并点击**导出聊天**
4. 选择**包含媒体**以包含照片、视频和语音消息
5. 保存文件（您可以使用 AirDrop、保存到文件或通过电子邮件发送）

### Android
1. 打开 WhatsApp 并进入任何聊天
2. 点击右上角的三个点 **⋮**
3. 点击**更多** → **导出聊天**
4. 选择**包含媒体**
5. 将 `.zip` 文件保存或共享到您的计算机

## 隐私与安全

此应用程序以隐私为最高优先级设计。您的 WhatsApp 数据永远不会离开您的设备。

### 为什么安全

- **100% 离线**：应用程序完全无需互联网即可工作
- **本地处理**：所有分析、搜索和处理都在您的浏览器中进行
- **本地 AI**：语音转录使用通过 WebGPU 本地运行的 Whisper
- **无追踪**：零分析、遥测或第三方脚本
- **无需账户**：无需注册、无需登录
- **开源**：所有代码在 AGPL-3.0 许可证下公开

## 开发脚本

| 命令 | 说明 |
|---------|-------------|
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 构建生产版本 |
| `npm run check` | 使用 svelte-check 进行类型检查 |
| `npm run lint` | 使用 Biome 进行代码检查 |
| `npm run electron:dev` | 在开发模式下运行 Electron |
| `npm run electron:build` | 构建 Electron 安装程序 |

## 构建技术

- [SvelteKit](https://kit.svelte.dev) + [Svelte 5](https://svelte.dev) - 框架
- [Tailwind CSS 4](https://tailwindcss.com) - 样式
- [Electron](https://electronjs.org) - 桌面应用
- [Transformers.js](https://huggingface.co/docs/transformers.js) - 用于转录的 Whisper AI
- [JSZip](https://stuk.github.io/jszip/) - ZIP 文件处理

## 贡献

发现错误或有想法？在 GitHub 上[提交问题](https://github.com/rodrigogs/whats-reader/issues)。

想要贡献代码？Fork 仓库，进行更改，然后提交拉取请求。

## 许可证

[AGPL-3.0](LICENSE)。您可以自由使用、修改和分发此软件。如果您修改它并作为服务运行或分发它，则必须在相同许可证下共享您的源代码。
