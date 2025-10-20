# Orienteering Monorepo

このリポジトリは、オリエンテーリング大会運営に関する学習用サービス群を monorepo 形式で管理しています。`StartlistManagement` がスタートリスト関連のドメインモデルと API を提供し、`EntryManagement` がエントリー登録向けのバックエンドを構成しています。共通フロントエンドは `apps/frontend` 配下にまとめられています。

## ワークスペース構成

| パス | 役割 |
| ---- | ---- |
| `apps/backend` | EntryManagement の Fastify HTTP エントリポイント。`EntryManagement/packages/*` を組み合わせた API サーバーを起動します。 |
| `apps/frontend` | Vite + React 製のスタートリスト操作 UI。`StartlistManagement` のユースケースを呼び出すワークフローを提供します。詳しくは [apps/frontend/README.md](./apps/frontend/README.md) を参照してください。 |
| `apps/shared-ui-components` | フロントエンド間で共有する UI コンポーネント群。 |
| `StartlistManagement` | スタートリストドメインの各レイヤ（domain/application/infrastructure/http 等）を収めたパッケージ群。詳細は [StartlistManagement/README.md](./StartlistManagement/README.md) を参照してください。 |
| `EntryManagement` | エントリー登録ドメインのレイヤ構造（domain/application/infrastructure/adapters-http）を提供します。レイヤ概要は [EntryManagement/README.md](./EntryManagement/README.md) にまとめています。 |
| `EventManagement` | 大会全体のイベント情報を管理する新しいバウンデッドコンテキスト。Domain/Application/Infrastructure/HTTP アダプタの 4 層構成でユースケースを提供します。詳細は [EventManagement/README.md](./EventManagement/README.md) を参照してください。 |
| `EventManagement/apps/backend` | EventManagement の Fastify HTTP エントリポイント。イベント作成やレーススケジュール管理 API を提供し、`STARTLIST_SYNC_BASE_URL` を指定するとスタートリスト同期 Webhook を呼び出します。 |

## 共通セットアップ

### 前提

- Node.js 20.x（LTS）
- npm 10 以上

### 依存関係のインストール

```bash
npm install
```

Monorepo のルートで実行すると、すべてのワークスペースの依存関係が解決されます。

### サービスの起動

- StartlistManagement のバックエンド API（Fastify）
  ```bash
  npm run dev:startlist-backend
  ```
- StartlistManagement のフロントエンド（Vite）
  ```bash
  npm run dev:frontend
  ```
  UI の利用手順や `VITE_STARTLIST_API_BASE_URL` の設定方法は [apps/frontend/README.md](./apps/frontend/README.md) を参照してください。
- EntryManagement のバックエンド API
  ```bash
  npm run dev:entry-backend
  ```
- EventManagement のバックエンド API
  ```bash
  npm run dev:event-backend
  ```

#### フロントエンドモジュールと必要なバックエンド

| フロントエンドモジュール | 必要なバックエンド / API | 環境変数の例 |
| --- | --- | --- |
| スタートリスト作成ウィザード (`apps/frontend` の startlist モジュール) | StartlistManagement HTTP サーバー | `VITE_STARTLIST_API_BASE_URL=http://localhost:3000` |
| エントリー管理プレースホルダー (`apps/frontend` の entryManagement モジュール) | EntryManagement HTTP サーバー | `VITE_ENTRY_MANAGEMENT_API_BASE_URL=http://localhost:3001` |
| EventManagement UI (`apps/frontend` の eventManagement モジュール) | EventManagement HTTP サーバー（必要に応じて StartlistManagement との同期のために `STARTLIST_SYNC_BASE_URL` も指定） | `VITE_EVENT_MANAGEMENT_API_BASE_URL=http://localhost:3002`

EventManagement UI を利用しない場合は `VITE_EVENT_MANAGEMENT_API_BASE_URL` を設定する必要はありませんが、イベント作成やレーススケジュールの操作を行う際はバックエンドを起動し、フロントエンドの `.env` に上記 URL を設定してください。

開発時に `npm run dev:frontend` を起動すると、Vite のプロキシ機能によって以下のエンドポイントがローカルサービスへ転送されます。`.env` で各 `VITE_*_API_BASE_URL` を設定すると、プロキシではなく指定したベース URL が利用されます。

- `/api/startlists`・`/api/japan-ranking` → `http://localhost:3000`
- `/api/entries` → `http://localhost:3001`
- `/api/events` → `http://localhost:3002`

### テスト

- StartlistManagement のテスト
  ```bash
  npm test --workspace startlist-management
  ```
- Startlist フロントエンドのテスト
  ```bash
  npm run test --workspace @orienteering/startlist-frontend
  ```
  startlistExport と StartTimesPanel の CSV エクスポート関連テストケースもこのコマンドで実行されます。

## ドキュメント

- [StartlistManagement ドメイン詳細](./StartlistManagement/README.md#startlistmanagement-ドメイン詳細)
- [スタートリスト UI と連携ガイド](./apps/frontend/README.md)
- [EntryManagement レイヤ概要と起動フロー](./EntryManagement/README.md)
