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

> **ダウンロード:** https://github.com/lutelute/marginalia/releases/latest

### macOS

**方法1: DMG版（推奨）**
1. `Marginalia-x.x.x-arm64.dmg` をダウンロード
2. DMGファイルを開き、アプリを「アプリケーション」フォルダにドラッグ
3. 初回起動時に「開発元が未確認」と表示された場合:
   - システム設定 → プライバシーとセキュリティ → 「このまま開く」をクリック

**方法2: ZIP版**
1. `Marginalia-x.x.x-arm64-mac.zip` をダウンロード
2. 解凍してアプリを「アプリケーション」フォルダに移動

### Windows

**方法1: インストーラー版（推奨）**
1. `Marginalia Setup x.x.x.exe` をダウンロード
2. ダウンロードしたexeファイルをダブルクリック
3. 自動でインストールされ、アプリが起動します

**方法2: ポータブル版（インストール不要）**
1. `Marginalia x.x.x.exe` をダウンロード
2. ダウンロードしたexeファイルをダブルクリックで即起動

> **Note:** 「WindowsによってPCが保護されました」と表示された場合は、「詳細情報」→「実行」をクリックしてください。

### Linux

**AppImage版:**
```bash
chmod +x Marginalia-x.x.x.AppImage
./Marginalia-x.x.x.AppImage
```

**Debian/Ubuntu (.deb):**
```bash
sudo dpkg -i marginalia_x.x.x_amd64.deb
```

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
    ├── document.mrgl                 # 注釈データ
    ├── backups/
    │   └── document_2026-02-05...    # MDバックアップ
    └── annotation-backups/
        └── document_2026-02-05...    # 注釈バックアップ
```

`.mrgl` ファイルはMarkdownのファイル名と1:1で対応します（`document.md` → `document.mrgl`）。絶対パスに依存しないため、プロジェクトフォルダごと移動しても注釈は維持されます。

> **Note:** v1.0.x で作成された旧形式（`document_abc123.mrgl`）は初回アクセス時に自動マイグレーションされます。

### ファイルの移動・リネーム

ファイルを移動/リネームする方法は3通りあります：

**方法1: アプリ内操作（推奨）**

ファイルツリーで右クリック → 「名前変更」または「移動...」を選択。注釈・バックアップが自動で追従します。

**方法2: CLIスクリプト**

```bash
# リネーム
node scripts/move-with-annotations.js docs/old.md docs/new.md

# ディレクトリ移動
node scripts/move-with-annotations.js docs/file.md archive/
```

**方法3: 手動**

`.mrgl` はファイル名ベースなので、手順はシンプルです：

```bash
# 1. MDファイルを移動
mv docs/old.md archive/old.md

# 2. .mrglファイルを同じ場所に移動
mkdir -p archive/.marginalia
mv docs/.marginalia/old.mrgl archive/.marginalia/old.mrgl
```

リネームの場合は `.mrgl` も同じ名前に変更するだけです：
```bash
mv docs/old.md docs/new.md
mv docs/.marginalia/old.mrgl docs/.marginalia/new.mrgl
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
