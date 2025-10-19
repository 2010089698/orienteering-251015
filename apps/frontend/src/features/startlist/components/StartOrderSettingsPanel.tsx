import { StatusMessage } from '@orienteering/shared-ui';
import useStartOrderSettings from '../hooks/useStartOrderSettings';

const StartOrderSettingsPanel = (): JSX.Element => {
  const {
    rows,
    availableClassIds,
    status,
    isLoading,
    handleAddRow,
    handleRemoveRow,
    handleClassChange,
    handleMethodChange,
    handleWorldRankingUpload,
  } = useStartOrderSettings();

  return (
    <section aria-labelledby="start-order-settings-heading" className="start-order-settings">
      <header>
        <h3 id="start-order-settings-heading">スタート順設定</h3>
        <p className="muted">世界ランキング順序を適用するクラスと方式を設定します。</p>
      </header>
      <div className="start-order-settings__rows" role="table">
        <div className="start-order-settings__header" role="row">
          <span role="columnheader">対象クラス</span>
          <span role="columnheader">リスト方式</span>
          <span role="columnheader">CSV ファイル</span>
          <span role="columnheader" className="visually-hidden">
            行操作
          </span>
        </div>
        {rows.map((row) => {
          const isRemoveDisabled = rows.length === 1;
          return (
            <div key={row.id} className="start-order-settings__row" role="row">
              <label className="start-order-settings__cell" role="cell">
                <span className="visually-hidden">対象クラス</span>
                <select
                  value={row.classId ?? ''}
                  onChange={(event) => handleClassChange(row.id, event)}
                  disabled={availableClassIds.length === 0}
                >
                  <option value="">クラスを選択</option>
                  {availableClassIds.map((classId) => {
                    const disabled = rows.some(
                      (other) => other.id !== row.id && other.classId === classId,
                    );
                    return (
                      <option key={classId} value={classId} disabled={disabled}>
                        {classId}
                      </option>
                    );
                  })}
                </select>
              </label>
              <label className="start-order-settings__cell" role="cell">
                <span className="visually-hidden">リスト方式</span>
                <select value={row.method} onChange={(event) => handleMethodChange(row.id, event)}>
                  <option value="random">既定（ランダム）</option>
                  <option value="worldRanking">世界ランキング逆順</option>
                </select>
              </label>
              <div className="start-order-settings__cell" role="cell">
                {row.method === 'worldRanking' ? (
                  <div className="stack">
                    <label htmlFor={`start-order-world-ranking-${row.id}`}>
                      世界ランキング CSV
                    </label>
                    <input
                      id={`start-order-world-ranking-${row.id}`}
                      type="file"
                      accept=".csv,text/csv"
                      onChange={handleWorldRankingUpload(row.id)}
                      disabled={!row.classId || isLoading}
                    />
                    <p className="muted">
                      {row.classId
                        ? row.csvName
                          ? `読み込み済み: ${row.csvName}`
                          : 'CSV を読み込んでください。'
                        : 'クラスを先に選択してください。'}
                    </p>
                  </div>
                ) : (
                  <p className="muted">CSV は不要です。</p>
                )}
              </div>
              <div
                className="start-order-settings__cell start-order-settings__cell--actions"
                role="cell"
              >
                <button
                  type="button"
                  className="secondary"
                  onClick={() => handleRemoveRow(row.id)}
                  disabled={isRemoveDisabled}
                >
                  行を削除
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="start-order-settings__actions">
        <button type="button" className="secondary" onClick={handleAddRow}>
          行を追加
        </button>
      </div>
      {availableClassIds.length === 0 ? (
        <p className="muted">エントリーにクラスがまだ登録されていません。</p>
      ) : null}
      <StatusMessage tone={status.level} message={status.text} />
    </section>
  );
};

export default StartOrderSettingsPanel;
