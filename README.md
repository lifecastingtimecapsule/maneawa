# Maneawa 28h チェッカー

完全オフラインで動作する「週28時間ルール」直近7日間チェック専用のデスクトップアプリです。Electron と TypeScript で構築され、SQLite データベースはユーザー環境内の1ファイルに保存されます。

## 主な機能

- **従業員管理**：氏名・備考の登録／編集／削除、重複登録の防止。
- **シフト管理**：従業員別に日付・開始／終了時刻を登録。夜勤などの日跨ぎも自動計算し、24時間超の入力はブロックします。
- **直近7日間チェック**：基準日を指定して従業員ごとの合計勤務時間を自動判定（OK／注意／NG）。注意・NG フィルタや日別内訳表示にも対応。
- **CSV 出力**：シフト一覧（月単位）および 7 日間集計結果を CSV 形式で保存可能。
- **バックアップ**：現在の SQLite ファイルを任意の場所へコピー。
- **自己責任利用の明示**：初回起動時に免責文言へ同意を求め、設定画面からも再表示できます。

## 技術スタック

- Electron (完全ローカル動作)
- TypeScript
- [sql.js](https://github.com/sql-js/sql.js)（SQLite を WASM 経由で利用）
- シンプルな HTML/CSS/TypeScript ベースのフロントエンド

## 開発環境のセットアップ

```bash
npm install
npm run build
npm start
```

`npm start` は TypeScript をビルドした後に Electron を起動します。ビルド成果物は `dist/` 以下に出力されます。

## データの保存場所

アプリは Electron の `app.getPath('userData')` 配下に `maneawa.sqlite` を作成します。このファイルをコピーするだけでバックアップが完了します。アプリ内の「バックアップを作成」ボタンでも同様のコピー処理が可能です。

## プロジェクト構成

```
├── src
│   ├── common        # 共有型定義
│   ├── main          # Electron メインプロセス・DB ロジック
│   └── renderer      # UI (HTML/CSS/TypeScript)
├── dist              # ビルド成果物（.gitignore 対象）
├── scripts           # ビルド補助スクリプト
└── README.md
```

## ライセンス

MIT License
