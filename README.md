# Marginalia

<p align="center">
  <img src="build/icon.svg" width="128" height="128" alt="Marginalia Logo">
</p>

<p align="center">
  <strong>Markdown編集ツール</strong><br>
  校閲・コメント・バージョン管理機能付き
</p>

<p align="center">
  <a href="https://github.com/lutelute/marginalia/releases">
    <img src="https://img.shields.io/github/v/release/lutelute/marginalia?style=flat-square" alt="Release">
  </a>
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-blue?style=flat-square" alt="Platform">
  <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="License">
</p>

---

## 機能

### エディタ
- **CodeMirror 6ベース** - シンタックスハイライト、行番号、自動インデント
- **リアルタイムプレビュー** - GFM（GitHub Flavored Markdown）対応
- **分割表示** - エディタとプレビューを並べて表示
- **ファイル情報** - 行数、単語数、文字数、更新日時などのメタデータ表示

### 注釈システム
テキストを選択して4種類の注釈を追加可能：
- **コメント** - 一般的なメモ
- **校閲** - 修正提案
- **保留** - 後で検討
- **議論** - スレッド形式の議論

注釈をクリックすると該当テキストにジャンプ＆ハイライト表示

### ファイル管理
- **ファイルツリー** - フォルダを開いてMarkdownファイルを一覧表示
- **フォルダ履歴** - 最近開いたフォルダを記憶
- **自動バックアップ** - 保存時に自動でバックアップ作成
- **履歴管理** - 操作履歴の自動記録

### UI
- **ダーク/ライトモード** - テーマ切り替え対応
- **パネルトグル** - サイドバー、エディタの表示/非表示
- **リサイズ可能** - 各パネルの幅を自由に調整
- **アップデート通知** - 新バージョンの確認機能

## インストール

### リリース版（推奨）

[Releases](https://github.com/lutelute/marginalia/releases) から最新版をダウンロード:

| OS | ファイル |
|----|---------|
| macOS | `Marginalia-x.x.x.dmg` または `.zip` |
| Windows | `Marginalia-Setup-x.x.x.exe` または `.portable.exe` |
| Linux | `Marginalia-x.x.x.AppImage` または `.deb` |

### 開発版

```bash
git clone https://github.com/lutelute/marginalia.git
cd marginalia
npm install
npm run dev
```

## 使い方

### 基本操作

1. **フォルダを開く** - 左サイドバーの「フォルダを開く」ボタンをクリック
2. **ファイルを選択** - ファイルツリーからMarkdownファイルをクリック
3. **編集** - 中央のエディタで編集、プレビューで確認
4. **保存** - `Cmd/Ctrl + S` または「保存」ボタン

### 注釈の追加

1. エディタまたはプレビューでテキストを選択
2. ポップアップから注釈タイプを選択
3. 注釈内容を入力して追加
4. 右パネルで注釈の管理（返信、解決、削除）

### キーボードショートカット

| 操作 | ショートカット |
|------|---------------|
| 保存 | `Cmd/Ctrl + S` |
| 設定 | `Cmd/Ctrl + ,` |

### パネル操作

TopBar左側のボタンで：
- サイドバー（ファイルツリー）の表示/非表示
- エディタの表示/非表示（プレビューのみモード）

## データ保存

### 注釈データ

注釈データは各ファイルと同じディレクトリの `.marginalia` フォルダに保存されます：

```
your-project/
├── document.md
└── .marginalia/
    ├── document_abc123.mrgl           # 注釈データ
    └── backups/
        └── document_abc123_2026-...   # バックアップ
```

### 設定

アプリケーション設定は `localStorage` に保存されます。

## ビルド

```bash
# 本番ビルド
npm run build:prod

# パッケージ作成
npm run package:mac     # macOS
npm run package:win     # Windows
npm run package:linux   # Linux
```

## 技術スタック

- **Electron** - クロスプラットフォームデスクトップアプリ
- **React 18** - UIフレームワーク
- **Vite** - ビルドツール
- **CodeMirror 6** - エディタエンジン
- **react-markdown** - Markdownレンダリング
- **remark-gfm** - GitHub Flavored Markdown対応

## ライセンス

MIT License
