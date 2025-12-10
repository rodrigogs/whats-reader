# <h1 align="center">WhatsApp バックアップリーダー</h1>

<p align="center">
  <img src="src/lib/assets/favicon.svg" width="100" height="100" alt="WhatsApp バックアップリーダー" />
</p>

<p align="center">
  <strong>WhatsAppのエクスポートをオフラインで閲覧。データはデバイス内に保存されます。</strong>
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

---

## 機能概要

WhatsAppからエクスポートした`.zip`ファイルをドラッグ＆ドロップして、メッセージ、写真、ボイスメモを閲覧できます。大規模なチャット（10,000件以上のメッセージでテスト済み）にも対応しています。

ボイスメッセージは、WebGPU経由でブラウザ内で実行される[Whisper](https://openai.com/research/whisper)を使用して文字起こしできます。サーバーもAPIキーも不要です。

## 主な機能

- **音声文字起こし**: Whisperでオーディオを文字起こし（ローカル実行、12以上の言語対応）
- **検索**: メッセージと文字起こしの全文検索
- **ブックマーク**: メモ付きでメッセージを保存、JSONでエクスポート/インポート
- **視点モード**: 任意の参加者としてチャットを表示
- **統計**: メッセージ数、アクティビティグラフ、タイムライン
- **ダークモード**: システムに従うか手動で切り替え（設定保存）
- **多言語UI**: 英語、ポルトガル語、スペイン語、フランス語、ドイツ語、イタリア語、オランダ語、日本語、中国語、ロシア語
- **デスクトップアプリ**: Electron経由でmacOS、Windows、Linuxに対応

## クイックスタート

### 前提条件

[Node.js](https://nodejs.org/)（バージョン18以降）がインストールされている必要があります。

```bash
node --version
```

### アプリの実行

```bash
npm install
npm run dev
```

ブラウザで[localhost:5173](http://localhost:5173)を開き、WhatsAppの`.zip`ファイルをドラッグ＆ドロップしてください。

### デスクトップアプリ（オプション）

```bash
npm run electron:dev    # 開発モードで実行
npm run electron:build  # OSのインストーラーを作成
```

## WhatsAppからエクスポートする方法

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

## プライバシーとセキュリティ

このアプリはプライバシーを最優先に設計されています。WhatsAppのデータはデバイスから出ることはありません。

### なぜ安全なのか

- **100%オフライン**: アプリはインターネット接続なしで完全に動作
- **ローカル処理**: すべての解析、検索、処理はブラウザ内で実行
- **ローカルAI**: 音声文字起こしはWebGPU経由でローカル実行されるWhisperを使用
- **トラッキングなし**: 分析、テレメトリ、サードパーティスクリプトは一切なし
- **アカウント不要**: 登録もログインも不要
- **オープンソース**: すべてのコードがAGPL-3.0ライセンスの下で公開

## 開発スクリプト

| コマンド | 説明 |
|---------|-------------|
| `npm run dev` | 開発サーバーを起動 |
| `npm run build` | 本番用にビルド |
| `npm run check` | svelte-checkで型チェック |
| `npm run lint` | Biomeでリント |
| `npm run electron:dev` | 開発モードでElectronを実行 |
| `npm run electron:build` | Electronインストーラーをビルド |

## 使用技術

- [SvelteKit](https://kit.svelte.dev) + [Svelte 5](https://svelte.dev) - フレームワーク
- [Tailwind CSS 4](https://tailwindcss.com) - スタイリング
- [Electron](https://electronjs.org) - デスクトップアプリ
- [Transformers.js](https://huggingface.co/docs/transformers.js) - 文字起こし用Whisper AI
- [JSZip](https://stuk.github.io/jszip/) - ZIPファイル処理

## 貢献

バグを見つけたりアイデアがありますか？GitHubで[issueを開く](https://github.com/rodrigogs/whats-reader/issues)。

コードで貢献したいですか？リポジトリをフォークして変更を加え、プルリクエストを開いてください。

## ライセンス

[AGPL-3.0](LICENSE)。このソフトウェアは自由に使用、変更、配布できます。変更してサービスとして実行または配布する場合は、同じライセンスの下でソースコードを共有する必要があります。
