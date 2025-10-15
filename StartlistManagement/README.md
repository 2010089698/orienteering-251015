# StartlistManagement

## プロジェクト概要
StartlistManagement は、オリエンテーリング大会のスタートリストを管理するための学習用サービスです。Fastify と TypeScript で構築した HTTP API と、Domain / Application / Infrastructure / Presentation の 4 層に分かれたドメイン駆動設計のアーキテクチャを採用しています。スタートリスト集約のライフサイクル（設定入力から確定まで）と、手動操作による再割当て時のドメインイベント処理を段階的に理解できる構成になっています。

## 主な機能
- スタートリスト設定（イベント ID・開始時刻・レーン数・インターバル）の入力とドメインイベント発行
- レーン割り当てとクラス順の決定、プレイヤー順の決定、スタート時間割り当てのユースケース提供
- スタートリストの確定処理と手動再割当て時のスタート時間自動無効化
- Fastify による RESTful API エンドポイント群と TypeBox スキーマ定義

## 技術スタック
- **言語/ランタイム**: Node.js、TypeScript、ts-node
- **Web フレームワーク**: Fastify + @fastify/type-provider-typebox
- **スキーマ定義**: @sinclair/typebox
- **テスト**: Vitest

## クイックスタート
1. 依存関係をインストールします。
   ```bash
   npm install
   ```
2. 開発サーバーを起動します（既定: `PORT=3000`, `HOST=0.0.0.0`）。
   ```bash
   npm start
   ```
   `Presentation/src/http/start.ts` でホストとポートを環境変数から解決しています。
3. ユニットテストを実行します。
   ```bash
   npm test
   ```

## プロジェクト構成
```
StartlistManagement/
├── Domain/                 # 集約とドメインイベント、値オブジェクト
├── Application/            # ユースケース、DTO、クエリサービス、プロセスマネージャ
├── Infrastructure/         # インメモリ永続化、イベントバス、トランザクション管理、DI 構成
└── Presentation/           # Fastify HTTP サーバーとルーティング
```
`createStartlistModule` が各レイヤの依存関係をまとめて初期化し、Fastify サーバーからユースケースとクエリを利用できるようにしています。

## ドメインモデル
- **Startlist 集約**: 設定入力、レーン/クラス/選手順の割り当て、スタート時間の割り当て、確定、手動再割当てによるスタート時間無効化などを一貫した不変条件下で管理します。各操作は該当するドメインイベントを蓄積し、後段の処理に通知します。
- **値オブジェクト**:
  - `StartlistSettings`: 有効なイベント ID・日時・レーン数を保証。
  - `LaneAssignment`: レーン番号の重複・範囲・クラス重複を検証。
  - `ClassAssignment`: クラス ID と選手順の重複を検証。
  - `Duration`: ミリ秒・秒・分での生成と値比較を提供。
  - `StartTime`: プレイヤー ID、日時、レーン番号の妥当性を保証。

## アプリケーション層
- すべてのユースケースサービスは `StartlistCommandBase` を継承し、リポジトリの読み込み・作成、トランザクション実行、イベント発行を共通化しています。
- プロセスマネージャは手動操作のドメインイベントを監視し、スタート時間の自動無効化コマンドを発行します。
- クエリサービスはインメモリのリポジトリからスタートリストのスナップショットを再利用します。

## インフラストラクチャ
- `InMemoryStartlistRepository` が集約スナップショットをメモリ上に保存します。
- `DomainEventBus` は購読者へ逐次イベントを配信し、プロセスマネージャをトリガーします。
- `SimpleTransactionManager` はトランザクション境界の抽象化のみを提供するシンプルな実装です。
- `createStartlistModule` はこれらの実装を束ね、イベント購読をセットアップします。

## プレゼンテーション層（HTTP API）
`/api/startlists/:id` 配下に以下のエンドポイントを提供します。

| 用途 | メソッド | パス | 説明 |
| ---- | -------- | ---- | ---- |
| 設定入力 | POST | `/api/startlists/:id/settings` | スタートリスト設定を登録しスナップショットを返す |
| レーン割り当て | POST | `/api/startlists/:id/lane-order` | レーン配列とクラス順、間隔を設定 |
| プレイヤー順決定 | POST | `/api/startlists/:id/player-order` | クラス内の選手順と間隔を設定 |
| スタート時間割り当て | POST | `/api/startlists/:id/start-times` | 選手ごとのスタート時間を設定 |
| 確定 | POST | `/api/startlists/:id/finalize` | スタートリストを確定状態にする |
| レーン手動再割当て | POST | `/api/startlists/:id/lane-order/manual` | 手動理由とともにレーン割り当てを更新し、既存スタート時間を無効化 |
| クラス順手動確定 | POST | `/api/startlists/:id/class-order/manual` | 手動理由とともにクラス順を確定し、既存スタート時間を無効化 |
| スタート時間無効化 | POST | `/api/startlists/:id/start-times/invalidate` | 手動理由を受け取りスタート時間を無効化 |
| 取得 | GET | `/api/startlists/:id` | 現在のスタートリストスナップショットを返す |

各ハンドラは TypeBox でバリデーションされたリクエストボディをユースケースに委譲し、標準化されたエラーハンドリングを提供します。

## ドメインイベントとプロセスマネージャ
- 手動レーン再割当てまたはクラス順手動確定のイベントを購読し、スタート時間の再計算が必要な状態を自動的に作ります。
- イベントは `DomainEventBus` を通じてプロセスマネージャへ伝播され、無効化コマンドが実行されます。

## テスト
Vitest によるユースケース・クエリ・HTTP 層のテストが用意されています。`npm test` で全テストを実行できます。主なテストスイート:
- `Application/src/application/startlist/__tests__` – コマンド、クエリ、プロセスマネージャ、マッパーのテスト
- `Presentation/src/http/__tests__/startlistRoutes.test.ts` – HTTP ルートとバリデーションのテスト

## 今後の発展・貢献ガイド
- 永続化層をデータベース実装に差し替え、`StartlistRepository` のインターフェースを活かした実運用対応を検討できます。
- 外部メッセージングシステムと連携するイベントバスの拡張や、複数集約にまたがるプロセスマネージャの追加が可能です。
- コントリビューション時は Issue/Pull Request を作成し、テストが通ることを確認してください。
