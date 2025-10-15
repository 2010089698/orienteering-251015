export const renderStartlistWizardPage = () => `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>スタートリスト生成ウィザード</title>
  <style>
    :root {
      color-scheme: light dark;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    body {
      margin: 0 auto;
      padding: 2rem;
      max-width: 1200px;
      line-height: 1.5;
    }

    header {
      margin-bottom: 2rem;
    }

    section {
      margin-bottom: 2.5rem;
      border: 1px solid rgba(0, 0, 0, 0.1);
      border-radius: 12px;
      padding: 1.5rem;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
      background: rgba(255, 255, 255, 0.85);
      backdrop-filter: blur(10px);
    }

    h2 {
      margin-top: 0;
    }

    fieldset {
      border: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 1rem;
    }

    label {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      font-size: 0.95rem;
    }

    input, select, button, textarea {
      font: inherit;
      padding: 0.5rem 0.75rem;
      border-radius: 8px;
      border: 1px solid rgba(0, 0, 0, 0.2);
      background: rgba(255, 255, 255, 0.9);
    }

    button.primary {
      background-color: #2563eb;
      color: #fff;
      border: none;
    }

    button[disabled] {
      opacity: 0.5;
      cursor: not-allowed;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 1rem;
    }

    th, td {
      padding: 0.5rem;
      border-bottom: 1px solid rgba(0, 0, 0, 0.1);
      text-align: left;
    }

    .status {
      margin-top: 0.75rem;
      font-size: 0.9rem;
    }

    .status.success {
      color: #15803d;
    }

    .status.error {
      color: #b91c1c;
    }

    .flex {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
      align-items: center;
    }

    .tag {
      display: inline-block;
      padding: 0.15rem 0.5rem;
      border-radius: 999px;
      font-size: 0.8rem;
      background: rgba(37, 99, 235, 0.15);
      color: #1d4ed8;
    }

    details {
      margin-top: 1rem;
      border: 1px solid rgba(0, 0, 0, 0.1);
      border-radius: 8px;
      padding: 0.75rem 1rem;
      background: rgba(250, 250, 250, 0.9);
    }

    details > summary {
      cursor: pointer;
      font-weight: 600;
    }

    ul.player-list {
      list-style: none;
      padding: 0;
      margin: 0.5rem 0 0;
      display: grid;
      gap: 0.25rem;
    }

    ul.player-list li {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.5rem;
      background: rgba(59, 130, 246, 0.08);
      padding: 0.4rem 0.6rem;
      border-radius: 6px;
    }

    .player-controls button {
      padding: 0.25rem 0.5rem;
      font-size: 0.8rem;
    }

    pre {
      background: rgba(15, 23, 42, 0.85);
      color: #e2e8f0;
      padding: 1rem;
      border-radius: 8px;
      overflow-x: auto;
      font-size: 0.8rem;
    }
  </style>
</head>
<body>
  <header>
    <h1>スタートリスト生成ウィザード</h1>
    <p>エントリー情報を入力し、自動計算ステップを順に進めることでスタートリストを確定します。各ステップの完了後は API へ送信し、最新スナップショットを確認できます。</p>
  </header>

  <section id="settings-section">
    <h2>1. 基本情報の入力</h2>
    <form id="settings-form">
      <fieldset>
        <label>
          スタートリスト ID
          <input id="startlist-id" name="startlistId" type="text" required placeholder="startlist-001" />
        </label>
        <label>
          大会 ID
          <input id="event-id" name="eventId" type="text" required placeholder="event-2025" />
        </label>
        <label>
          開始時刻
          <input id="start-time" name="startTime" type="datetime-local" required />
        </label>
        <label>
          スタート間隔（分）
          <input id="interval-minutes" name="intervalMinutes" type="number" min="0" value="2" />
        </label>
        <label>
          スタート間隔（秒）
          <input id="interval-seconds" name="intervalSeconds" type="number" min="0" max="59" value="0" />
        </label>
        <label>
          レーン数
          <input id="lane-count" name="laneCount" type="number" min="1" value="1" required />
        </label>
      </fieldset>
      <div class="flex">
        <button class="primary" type="submit">設定を送信</button>
        <button type="button" id="refresh-snapshot">最新状態を取得</button>
      </div>
    </form>
    <div id="settings-status" class="status"></div>
  </section>

  <section id="entries-section">
    <h2>2. エントリー入力</h2>
    <form id="entry-form" class="flex">
      <label>
        選手名
        <input name="name" type="text" required />
      </label>
      <label>
        所属
        <input name="club" type="text" />
      </label>
      <label>
        クラス ID
        <input name="classId" type="text" required placeholder="M21A" />
      </label>
      <label>
        カード番号（選手 ID）
        <input name="cardNo" type="text" required placeholder="123456" />
      </label>
      <button class="primary" type="submit">追加</button>
    </form>
    <p class="status" id="entry-status"></p>
    <table>
      <thead>
        <tr>
          <th>選手名</th>
          <th>所属</th>
          <th>クラス</th>
          <th>カード番号</th>
          <th></th>
        </tr>
      </thead>
      <tbody id="entry-table-body"></tbody>
    </table>
  </section>

  <section id="lane-section">
    <h2>3. レーン割り当て</h2>
    <div class="flex">
      <button type="button" id="generate-lane-order">レーン割り当てを自動生成</button>
      <button type="button" id="submit-lane-order" class="primary">API に送信</button>
    </div>
    <div id="lane-status" class="status"></div>
    <div id="lane-assignments"></div>
  </section>

  <section id="class-section">
    <h2>4. クラス内順序</h2>
    <div class="flex">
      <button type="button" id="generate-class-order">クラス内順序を自動生成</button>
      <button type="button" id="submit-class-order" class="primary">API に送信</button>
    </div>
    <p class="status">カード番号昇順を初期案とし、必要に応じて上下ボタンで並び替えを調整してください。</p>
    <div id="class-status" class="status"></div>
    <div id="class-assignments"></div>
  </section>

  <section id="start-times-section">
    <h2>5. スタート時間生成</h2>
    <div class="flex">
      <button type="button" id="generate-start-times">スタート時間を計算</button>
      <button type="button" id="submit-start-times" class="primary">API に送信</button>
      <button type="button" id="invalidate-start-times">スタート時間をリセット</button>
      <button type="button" id="finalize-startlist">スタートリストを確定</button>
    </div>
    <div id="start-times-status" class="status"></div>
    <table>
      <thead>
        <tr>
          <th>カード番号</th>
          <th>クラス</th>
          <th>選手名</th>
          <th>レーン</th>
          <th>スタート時刻</th>
        </tr>
      </thead>
      <tbody id="start-times-table"></tbody>
    </table>
  </section>

  <section>
    <h2>6. スナップショット</h2>
    <p>最新のバックエンド状態を確認できます。</p>
    <pre id="snapshot-viewer">{\n  "status": "未取得"\n}</pre>
  </section>

  <script type="module" src="/startlist-wizard.js"></script>
</body>
</html>`;
