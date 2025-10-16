import { Tag } from '@startlist-management/ui-components';
import { createStatus, removeEntry, setStatus, useStartlistDispatch, useStartlistState } from '../state/StartlistContext';

const EntryTable = (): JSX.Element => {
  const { entries } = useStartlistState();
  const dispatch = useStartlistDispatch();

  const handleRemove = (cardNo: string) => {
    const remaining = Math.max(entries.length - 1, 0);
    removeEntry(dispatch, cardNo);
    setStatus(dispatch, 'entries', createStatus(`${remaining} 件のエントリーがあります。`, 'info'));
  };

  if (entries.length === 0) {
    return <p className="muted">登録済みの参加者はまだいません。</p>;
  }

  return (
    <div>
      <h3>登録済みの参加者</h3>
      <div className="table-wrapper">
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
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.cardNo}>
                <td>{entry.name || '（未入力）'}</td>
                <td>{entry.club || '—'}</td>
                <td>
                  <Tag label={entry.classId} tone="info" />
                </td>
                <td>{entry.cardNo}</td>
                <td>
                  <button type="button" className="secondary" onClick={() => handleRemove(entry.cardNo)}>
                    削除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default EntryTable;
