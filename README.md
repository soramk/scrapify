# Web2RAG - Scrapify

WebページのURLからメインコンテンツを抽出し、LLMのRAG（検索拡張生成）システムに最適な **Markdown形式** および **チャンク（分割）データ** に変換する静的Webアプリケーションです。

## 機能

- **URL入力によるコンテンツ取得** — CORSプロキシ経由でWebページのHTMLを安全に取得
- **メインコンテンツ抽出** — nav, footer, header等の不要要素を除去し、記事本文のみを抽出
- **Markdown変換** — 見出し、リスト、テーブル、コードブロック等を高精度にMarkdown化
- **チャンク分割** — H1/H2見出し単位でRAGベクトル化に最適な分割を実行
- **エクスポート** — クリップボードコピー / ファイルダウンロード (.md / .txt)

## 技術スタック

- **React** (Vite)
- **Tailwind CSS** v4
- **Lucide React** (アイコン)

## セットアップ

```bash
npm install
npm run dev
```

## デプロイ

`main`ブランチへのPushで、GitHub Actionsによる自動ビルド＆GitHub Pagesデプロイが実行されます。
