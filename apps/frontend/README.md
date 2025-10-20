# Startlist Frontend

## ドキュメントナビゲーション

- [StartlistManagement ドメイン詳細](../../StartlistManagement/README.md)
- [共通セットアップとワークスペース一覧](../../README.md)

## アプリ概要

`apps/frontend` は Vite + React + TypeScript で構築された単一ページアプリケーションです。スタートリスト作成ウィザードを中心に、モジュール登録された各業務領域の UI を共通レイアウト上で切り替えられるように設計しています。

### モジュール登録の仕組み

- `src/contexts/registry.ts` が業務モジュール (`BusinessCapabilityModule`) を管理します。`startlistModule` と `entryManagementModule` を初期登録し、`registerBusinessCapability` を通じて追加モジュールを受け付けます。
- 各モジュールは `id`・`routePath`・`navigationLabel`・`component` に加え、必要に応じて `providers` と `hooks` を提供します。`providers` 配列は `App.tsx` 内の `applyProviders` ヘルパーによって動的に適用され、各モジュール固有のコンテキストや API クライアントを組み込めます。
- 追加の業務機能を実装する場合は `registerBusinessCapability` にモジュールを登録し、`getBusinessCapabilities` から取得される配列に並ぶ順番がサイドナビゲーションとルーティングの双方に反映されます。

### ナビゲーション構造

- `src/App.tsx` がアプリ全体のエントリーポイントです。`BrowserRouter` を基盤に、左側に業務モジュールの一覧 (`NavLink`) を並べたサイドナビ、右側に選択されたモジュールの画面を描画する構成となっています。
- ルート (`/`) へアクセスした場合は最初に登録されたモジュールへ自動でリダイレクトします。ナビゲーション項目は `getNavigationItems` の返り値をもとに動的生成され、モジュールの `routePath` に基づいたネストされたルーティング (`<Route path="${module.routePath}/*" />`) がセットアップされます。

### 主要画面

- **スタートリスト作成ウィザード** (`src/features/startlist/pages/StartlistWorkflowPage.tsx`)
  - 入力・レーン調整・順序と時間の 3 ステップで構成されたウィザードです。
  - `StartlistProvider` が API と状態管理 (`useStartlistApi`) を供給し、各ステップコンポーネント（`InputStep`・`LaneAssignmentStep`・`ClassOrderStep`）がフォーム入力とワークフロー制御を担当します。
  - 左カラムのステップインジケーターが現在位置を可視化し、右カラムのカード内で各ステップを切り替えます。
- **エントリー管理モック画面** (`src/features/entry-management/pages/EntryManagementPlaceholder.tsx`)
  - 現状はモック API (`useEntryManagementApi`) に対するフェッチ結果を JSON で表示する開発中のプレースホルダーです。
  - バックエンドが実装されるまでの間、`useEffect` でモックデータを取得して状態に格納し、将来の実装時の枠組みを提供しています。

## セットアップ

### 前提条件

- Monorepo 共通の依存関係はルートで `npm install` を実行して解決します。詳細は [共通セットアップ](../../README.md#共通セットアップ) を参照してください。

### 環境変数

- StartlistManagement のバックエンド API に接続するため、`apps/frontend/.env`（または `.env.local`）へ `VITE_STARTLIST_API_BASE_URL` を設定します。
  ```dotenv
  VITE_STARTLIST_API_BASE_URL=http://localhost:3000
  ```
- EventManagement の機能を利用する場合は、同じファイルへ `VITE_EVENT_MANAGEMENT_API_BASE_URL` も追加し、`npm run dev:event-backend` で起動した EventManagement API のベース URL を指定してください。
  ```dotenv
  VITE_EVENT_MANAGEMENT_API_BASE_URL=http://localhost:3002
  ```
- 各値はバックエンドの起動ポートに合わせて更新してください。Fastify 開発サーバーのデフォルトは StartlistManagement が `3000`、EventManagement が `3002` です。
- `.env` に値を設定しない場合でも、開発中は Vite のプロキシ設定によって以下のデフォルトポートへ転送されます。必要に応じて環境変数で上書きしてください。
  - `/api/startlists`・`/api/japan-ranking` → `http://localhost:3000`
  - `/api/entries` → `http://localhost:3001`
  - `/api/events` → `http://localhost:3002`

### 開発サーバーの起動

1. StartlistManagement のバックエンド API を起動します。
   ```bash
   npm run dev:startlist-backend
   ```
2. 別ターミナルでフロントエンドを起動します。
   ```bash
   npm run dev:frontend
   ```
3. ブラウザで `http://localhost:5173` を開き、サイドバーから「スタートリスト」を選択してウィザードを操作します。

バックエンドのユースケースや API 詳細については [StartlistManagement/README.md](../../StartlistManagement/README.md) を参照し、本ドキュメントは UI と連携手順のハブとして活用してください。

