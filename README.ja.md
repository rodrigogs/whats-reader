<h1 align="center">WhatsApp バックアップリーダー</h1>

<p align="center">
  <img src="src/lib/assets/favicon.svg" width="100" height="100" alt="WhatsApp バックアップリーダー" />
</p>

<p align="center">
  <strong>WhatsAppのエクスポートをオフラインで閲覧。データはデバイス内に保存されます。</strong>
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
  <strong>日本語</strong> •
  <a href="README.zh.md">中文</a> •
  <a href="README.ru.md">Русский</a>
</p>

<p align="center">
  <a href="#主な機能">主な機能</a> •
  <a href="#クイックスタート">クイックスタート</a> •
  <a href="#whatsappからエクスポートする方法">エクスポートガイド</a> •
  <a href="#プライバシーとセキュリティ">プライバシー</a> •
  <a href="#貢献">貢献</a>
</p>

---

## 機能概要

WhatsAppからエクスポートした`.zip`ファイルをドラッグ＆ドロップして、メッセージ、写真、ボイスメモを閲覧できます。大規模なチャット（10,000件以上のメッセージでテスト済み）にも対応しています。

ボイスメッセージは、WebGPU経由でブラウザ内で実行される[Whisper](https://openai.com/research/whisper)を使用して文字起こしできます。サーバーもAPIキーも不要です。

<details>
<summary>スクリーンショット</summary>
<br>

| スタート画面 | チャット表示 |
|:---:|:---:|
| <img src="examples/images/1-start.png" width="400" /> | <img src="examples/images/2-chats.png" width="400" /> |

| チャットオプション | 視点モード |
|:---:|:---:|
| <img src="examples/images/3-chat-options.png" width="400" /> | <img src="examples/images/4-view-as.png" width="400" /> |

| ブックマーク | 統計 |
|:---:|:---:|
| <img src="examples/images/5-bookmarks.png" width="400" /> | <img src="examples/images/6-statistics.png" width="400" /> |

| 音声文字起こし |
|:---:|
| <img src="examples/images/7-audio-transcription.png" width="400" /> |

</details>

---

## 主な機能

- **音声文字起こし**: Whisperでオーディオを文字起こし（ローカル実行、12以上の言語対応）
- **検索**: メッセージと文字起こしの全文検索
- **ブックマーク**: メモ付きでメッセージを保存、JSONでエクスポート/インポート
- **視点モード**: 任意の参加者としてチャットを表示
- **統計**: メッセージ数、アクティビティグラフ、タイムライン
- **ダークモード**: システムに従うか手動で切り替え（設定保存）
- **多言語UI**: 英語、ポルトガル語、スペイン語、フランス語、ドイツ語、イタリア語、オランダ語、日本語、中国語、ロシア語
- **デスクトップアプリ**: Electron経由でmacOS、Windows、Linuxに対応

---

## クイックスタート

### 前提条件

[Node.js](https://nodejs.org/)（バージョン18以降）がインストールされている必要があります。[nodejs.org](https://nodejs.org/)からダウンロードしてインストーラーを実行してください。

インストールされているか確認するには:
```bash
node --version
```

### アプリの実行

1. このプロジェクトをクローンまたはダウンロード
2. プロジェクトフォルダでターミナルを開く
3. 次のコマンドを実行:

```bash
npm install
npm run dev
```

4. ブラウザで[localhost:5173](http://localhost:5173)を開く
5. WhatsAppの`.zip`ファイルをページにドラッグ＆ドロップ

### デスクトップアプリ（オプション）

ブラウザの代わりにスタンドアロンアプリを使用する場合:

```bash
npm run electron:dev    # 開発モードで実行
npm run electron:build  # OSのインストーラーを作成
```

プラットフォーム固有のビルド:
```bash
npm run electron:build:mac    # macOS (dmg, zip)
npm run electron:build:win    # Windows (nsis, portable)
npm run electron:build:linux  # Linux (AppImage, deb)
```

---

## WhatsAppからエクスポートする方法

まず、スマートフォンのWhatsAppからチャットをエクスポートする必要があります。これにより、メッセージとメディアを含む`.zip`ファイルが作成されます。

### iPhone
1. WhatsAppを開き、任意のチャットに移動
2. 画面上部の連絡先またはグループ名をタップ
3. 下にスクロールして**チャットをエクスポート**をタップ
4. **メディアを含める**を選択して、写真、動画、ボイスメッセージを含める
5. ファイルを保存（AirDropでMacに送る、ファイルに保存、またはメールで送信）

### Android
1. WhatsAppを開き、任意のチャットに移動
2. 右上の3つの点**⋮**をタップ
3. **その他** → **チャットをエクスポート**をタップ
4. **メディアを含める**を選択
5. `.zip`ファイルをコンピューターに保存または共有

### ヒント
- 大きなチャットのエクスポートには数分かかる場合があります
- ファイル名は`WhatsApp Chat with John.zip`のような形式になります
- 個人チャットとグループチャットの両方が機能します

---

## プライバシーとセキュリティ

このアプリはプライバシーを最優先に設計されています。WhatsAppのデータはデバイスから出ることはありません。

### なぜ安全なのか

- **100%オフライン**: アプリはインターネット接続なしで完全に動作します。サーバーなし、クラウドなし、データ送信なし。
- **ローカル処理**: すべての解析、検索、処理はブラウザまたはElectronアプリ内で実行されます。
- **ローカルAI**: 音声文字起こしはWebGPU経由でローカル実行される[Whisper](https://openai.com/research/whisper)を使用します。音声はサーバーやAPIに送信されません。
- **トラッキングなし**: 分析、テレメトリ、サードパーティスクリプトは一切ありません。Google Analyticsもクッキーもありません。
- **アカウント不要**: 登録もログインも個人データの収集もありません。
- **オープンソース**: コードベース全体が[AGPL-3.0](LICENSE)の下で公開されています。誰でも監査できます。

### 検証方法

私たちを信頼するだけでなく、自分で検証してください:

1. **ソースコードを読む**  
   [GitHubリポジトリ](https://github.com/rodrigogs/whats-reader)を閲覧してください。主なロジックは`src/lib/`と`src/routes/`にあります。

2. **ネットワークリクエストを確認**  
   ブラウザのDevTools（F12）→ Networkタブ → アプリを使用。**外部リクエストはゼロ**（Web版を使用する場合の初期ページロードを除く）であることがわかります。

3. **オフラインでテスト**  
   インターネットから切断してからアプリを使用してください。接続を必要としないため、すべてが機能します。

4. **ソースからビルド**  
   リポジトリをクローンして自分でビルド:
   ```bash
   git clone https://github.com/rodrigogs/whats-reader.git
   cd whats-reader
   npm install
   npm run build
   ```

5. **Electronアプリを監査**  
   デスクトップアプリは同じWebコードを使用します。`electron/main.cjs`と`electron/preload.cjs`を確認してください。ウィンドウ管理とファイルダイアログのみを処理します。

---

## 開発

### スクリプト

| コマンド | 説明 |
|---------|-------------|
| `npm run dev` | [localhost:5173](http://localhost:5173)で開発サーバーを起動 |
| `npm run build` | 本番用にビルド |
| `npm run preview` | 本番ビルドのプレビュー |
| `npm run check` | svelte-checkで型チェック |
| `npm run check:watch` | ウォッチモードで型チェック |
| `npm run lint` | Biomeでリント |
| `npm run lint:fix` | リント問題を自動修正 |
| `npm run format` | Biomeでコードをフォーマット |
| `npm run electron` | Electronアプリをビルドして実行 |
| `npm run electron:dev` | 開発モードでElectronを実行 |
| `npm run electron:build` | Electronインストーラーをビルド |
| `npm run electron:build:mac` | macOS用にビルド |
| `npm run electron:build:win` | Windows用にビルド |
| `npm run electron:build:linux` | Linux用にビルド |
| `npm run machine-translate` | inlangで自動翻訳 |

### 翻訳の追加

翻訳ファイルは`messages/`にあります。新しい言語を追加するには:
1. `messages/en.json`を`messages/{locale}.json`にコピー
2. 文字列を翻訳
3. `project.inlang/settings.json`にロケールを追加

---

## 使用技術

- [SvelteKit](https://kit.svelte.dev) + [Svelte 5](https://svelte.dev) - フレームワーク
- [Tailwind CSS 4](https://tailwindcss.com) - スタイリング
- [Electron](https://electronjs.org) - デスクトップアプリ
- [Transformers.js](https://huggingface.co/docs/transformers.js) - 文字起こし用Whisper AI
- [JSZip](https://stuk.github.io/jszip/) - ZIPファイル処理
- [Paraglide JS](https://inlang.com/m/gerre34r/library-inlang-paraglideJs) - 国際化

---

## 貢献

バグを見つけたりアイデアがありますか？GitHubで[issueを開く](https://github.com/rodrigogs/whats-reader/issues)。

コードで貢献したいですか？リポジトリをフォークして変更を加え、プルリクエストを開いてください。

テスト用に使用できるサンプルチャットファイルが`examples/chats/`にあります。

---

## ライセンス

[AGPL-3.0](LICENSE)。このソフトウェアは自由に使用、変更、配布できます。変更してサービスとして実行または配布する場合は、同じライセンスの下でソースコードを共有する必要があります。
