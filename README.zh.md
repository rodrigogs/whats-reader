<h1 align="center">WhatsApp 备份阅读器</h1>

<p align="center">
  <img src="src/lib/assets/favicon.svg" width="100" height="100" alt="WhatsApp 备份阅读器" />
</p>

<p align="center">
  <strong>离线浏览您的 WhatsApp 导出数据。您的数据保留在设备上。</strong>
</p>

<p align="center">
  <a href="https://github.com/rodrigogs/whats-reader/releases/latest"><img src="https://img.shields.io/github/v/release/rodrigogs/whats-reader?style=flat-square&color=blue" alt="Latest Release" /></a>
  <a href="https://github.com/rodrigogs/whats-reader/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/rodrigogs/whats-reader/ci.yml?branch=dev&style=flat-square&label=CI" alt="CI Status" /></a>
  <a href="https://github.com/rodrigogs/whats-reader/blob/main/LICENSE"><img src="https://img.shields.io/github/license/rodrigogs/whats-reader?style=flat-square" alt="License" /></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Svelte-5-FF3E00?style=flat-square&logo=svelte&logoColor=white" alt="Svelte 5" />
  <img src="https://img.shields.io/badge/Electron-39-47848F?style=flat-square&logo=electron&logoColor=white" alt="Electron 39" />
  <img src="https://img.shields.io/badge/AI-Whisper_(local)-00A67E?style=flat-square&logo=openai&logoColor=white" alt="Local Whisper AI" />
  <img src="https://img.shields.io/badge/Privacy-100%25_offline-4CAF50?style=flat-square&logo=shield&logoColor=white" alt="100% Offline" />
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

<p align="center">
  <a href="#主要特性">主要特性</a> •
  <a href="#快速开始">快速开始</a> •
  <a href="#如何从-whatsapp-导出">导出指南</a> •
  <a href="#隐私与安全">隐私</a> •
  <a href="#贡献">贡献</a>
</p>

---

## 功能介绍

拖放从 WhatsApp 导出的 `.zip` 文件，浏览您的消息、照片和语音备忘录。适用于大型聊天（已测试超过 10,000 条消息）。

语音消息可以使用通过 WebGPU 在浏览器中运行的 [Whisper](https://openai.com/research/whisper) 进行转录。无需服务器，无需 API 密钥。

<details>
<summary>截图</summary>
<br>

| 开始屏幕 | 聊天视图 |
|:---:|:---:|
| <img src="examples/images/1-start.png" width="400" /> | <img src="examples/images/2-chats.png" width="400" /> |

| 聊天选项 | 视角模式 |
|:---:|:---:|
| <img src="examples/images/3-chat-options.png" width="400" /> | <img src="examples/images/4-view-as.png" width="400" /> |

| 书签 | 统计 |
|:---:|:---:|
| <img src="examples/images/5-bookmarks.png" width="400" /> | <img src="examples/images/6-statistics.png" width="400" /> |

| 语音转录 |
|:---:|
| <img src="examples/images/7-audio-transcription.png" width="400" /> |

</details>

---

## 下载

为您的平台下载应用:

### Windows
- 从[最新版本](https://github.com/rodrigogs/whats-reader/releases/latest)下载 **WhatsApp-Backup-Reader-Setup-{version}.exe**
- 运行安装程序并按照设置向导操作
- 应用程序将在有新版本时自动更新

### macOS
- **Apple Silicon (M1/M2/M3)**: 下载 **WhatsApp-Backup-Reader-{version}-arm64.dmg**
- **Intel**: 下载 **WhatsApp-Backup-Reader-{version}.dmg**
- 打开DMG文件并将应用拖到应用程序文件夹
- 首次启动时,右键点击应用并选择"打开"以绕过Gatekeeper

### Linux
- **Debian/Ubuntu**: 下载 **whats-reader_{version}_amd64.deb** 或 **whats-reader_{version}_arm64.deb**
  ```bash
  sudo dpkg -i whats-reader_{version}_amd64.deb
  ```
- **Fedora/RHEL**: 下载 **whats-reader-{version}.x86_64.rpm** 或 **whats-reader-{version}.aarch64.rpm**
  ```bash
  sudo rpm -i whats-reader-{version}.x86_64.rpm
  ```
- **其他发行版 (Arch等)**: 下载 **WhatsApp-Backup-Reader-{version}.AppImage**
  ```bash
  chmod +x WhatsApp-Backup-Reader-{version}.AppImage
  ./WhatsApp-Backup-Reader-{version}.AppImage
  ```

> **或使用Web版本**: 访问 [rodrigogs.github.io/whats-reader](https://rodrigogs.github.io/whats-reader) - 无需安装!

---

## 主要特性

- **语音转录**：使用 Whisper 转录音频（本地运行，支持 12 种以上语言）
- **搜索**：在消息和转录中进行全文搜索
- **书签**：保存带有笔记的消息，导出/导入为 JSON
- **视角模式**：以任何参与者的身份查看聊天
- **统计**：消息计数、活动图表、时间线
- **暗黑模式**：跟随系统或手动切换（保存偏好）
- **多语言界面**：英语、葡萄牙语、西班牙语、法语、德语、意大利语、荷兰语、日语、中文、俄语
- **桌面应用**：通过 Electron 支持 macOS、Windows、Linux

---

## 快速开始

### 前置要求

您需要安装 [Node.js](https://nodejs.org/)（版本 18 或更高）。从 [nodejs.org](https://nodejs.org/) 下载并运行安装程序。

检查是否已安装:
```bash
node --version
```

### 运行应用

1. 克隆或下载此项目
2. 在项目文件夹中打开终端
3. 运行以下命令:

```bash
npm install
npm run dev
```

4. 在浏览器中打开 [localhost:5173](http://localhost:5173)
5. 将您的 WhatsApp `.zip` 文件拖放到页面中

### 桌面应用（可选）

如果您更喜欢独立应用而不是使用浏览器:

```bash
npm run electron:dev    # 在开发模式下运行
npm run electron:build  # 为您的操作系统创建安装程序
```

特定平台构建:
```bash
npm run electron:build:mac    # macOS (dmg, zip)
npm run electron:build:win    # Windows (nsis, portable)
npm run electron:build:linux  # Linux (deb, rpm, AppImage)
```

---

## 如何从 WhatsApp 导出

首先，您需要在手机上从 WhatsApp 导出聊天。这会创建一个包含您的消息和媒体的 `.zip` 文件。

### iPhone
1. 打开 WhatsApp 并进入任何聊天
2. 点击屏幕顶部的联系人或群组名称
3. 向下滚动并点击**导出聊天**
4. 选择**包含媒体**以包含照片、视频和语音消息
5. 保存文件（您可以使用 AirDrop 发送到 Mac、保存到文件或通过电子邮件发送给自己）

### Android
1. 打开 WhatsApp 并进入任何聊天
2. 点击右上角的三个点 **⋮**
3. 点击**更多** → **导出聊天**
4. 选择**包含媒体**
5. 将 `.zip` 文件保存或共享到您的计算机

### 提示
- 大型聊天可能需要几分钟才能导出
- 文件名类似于 `WhatsApp Chat with John.zip`
- 个人聊天和群聊都可以使用

---

## 隐私与安全

此应用程序以隐私为最高优先级设计。您的 WhatsApp 数据永远不会离开您的设备。

### 为什么安全

- **100% 离线**：应用程序完全无需互联网即可工作。无服务器、无云、无数据传输。
- **本地处理**：所有解析、搜索和分析都在您的浏览器或 Electron 应用中进行。
- **本地 AI**：语音转录使用通过 WebGPU 本地运行的 [Whisper](https://openai.com/research/whisper)。不会向任何服务器或 API 发送音频。
- **无追踪**：零分析、遥测或第三方脚本。无 Google Analytics、无 cookies。
- **无需账户**：无需注册、无需登录、不收集个人数据。
- **开源**：整个代码库在 [AGPL-3.0](LICENSE) 许可证下公开。任何人都可以审计它。

### 如何验证

不要只相信我们。自己验证:

1. **阅读源代码**  
   浏览 [GitHub 仓库](https://github.com/rodrigogs/whats-reader)。主要逻辑在 `src/lib/` 和 `src/routes/` 中。

2. **检查网络请求**  
   打开浏览器的 DevTools（F12）→ Network 选项卡 → 使用应用。您将看到**零外部请求**（如果使用 Web 版本，初始页面加载除外）。

3. **离线测试**  
   断开互联网连接，然后使用应用。一切都能正常工作，因为不需要连接。

4. **从源代码构建**  
   克隆仓库并自己构建:
   ```bash
   git clone https://github.com/rodrigogs/whats-reader.git
   cd whats-reader
   npm install
   npm run build
   ```

5. **审计 Electron 应用**  
   桌面应用使用相同的 Web 代码。检查 `electron/main.cjs` 和 `electron/preload.cjs`。它们只处理窗口管理和文件对话框。

---

## 开发

### 脚本

| 命令 | 说明 |
|---------|-------------|
| `npm run dev` | 在 [localhost:5173](http://localhost:5173) 启动开发服务器 |
| `npm run build` | 构建生产版本 |
| `npm run preview` | 预览生产构建 |
| `npm run check` | 使用 svelte-check 进行类型检查 |
| `npm run check:watch` | 在监视模式下进行类型检查 |
| `npm run lint` | 使用 Biome 进行代码检查 |
| `npm run lint:fix` | 自动修复代码检查问题 |
| `npm run format` | 使用 Biome 格式化代码 |
| `npm run electron` | 构建并运行 Electron 应用 |
| `npm run electron:dev` | 在开发模式下运行 Electron |
| `npm run electron:build` | 构建 Electron 安装程序 |
| `npm run electron:build:mac` | 为 macOS 构建 |
| `npm run electron:build:win` | 为 Windows 构建 |
| `npm run electron:build:linux` | 为 Linux 构建 |
| `npm run machine-translate` | 使用 inlang 自动翻译 |

### 添加翻译

翻译文件位于 `messages/`。添加新语言:
1. 将 `messages/en.json` 复制到 `messages/{locale}.json`
2. 翻译字符串
3. 将语言代码添加到 `project.inlang/settings.json`

---

## 构建技术

- [SvelteKit](https://kit.svelte.dev) + [Svelte 5](https://svelte.dev) - 框架
- [Tailwind CSS 4](https://tailwindcss.com) - 样式
- [Electron](https://electronjs.org) - 桌面应用
- [Transformers.js](https://huggingface.co/docs/transformers.js) - 用于转录的 Whisper AI
- [JSZip](https://stuk.github.io/jszip/) - ZIP 文件处理
- [Paraglide JS](https://inlang.com/m/gerre34r/library-inlang-paraglideJs) - 国际化

---

## 贡献

发现错误或有想法？在 GitHub 上[提交问题](https://github.com/rodrigogs/whats-reader/issues)。

想要贡献代码？Fork 仓库，进行更改，然后提交拉取请求。

在 `examples/chats/` 中有示例聊天文件可用于测试。

---

## 许可证

[AGPL-3.0](LICENSE)。您可以自由使用、修改和分发此软件。如果您修改它并作为服务运行或分发它，则必须在相同许可证下共享您的源代码。
