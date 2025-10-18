import { Tag } from '@orienteering/shared-ui';
import type { Entry } from '../state/types';

type EntryTableProps = {
  entries: Entry[];
  onRemove?: (id: string) => void;
  emptyMessage?: string;
};

const EntryTable = ({ entries, onRemove, emptyMessage }: EntryTableProps): JSX.Element => {
  if (entries.length === 0) {
    return <p className="muted">{emptyMessage ?? '該当する参加者がいません。'}</p>;
  }

  const hasIofId = entries.some((entry) => entry.iofId && entry.iofId.trim().length > 0);

  return (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>選手名</th>
            <th>所属</th>
            <th>クラス</th>
            {hasIofId && <th>IOF ID</th>}
            <th>カード番号</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id}>
              <td>{entry.name || '（未入力）'}</td>
              <td>{entry.club || '—'}</td>
              <td>
                <Tag label={entry.classId} tone="info" />
              </td>
              {hasIofId && <td>{entry.iofId ?? '—'}</td>}
              <td>{entry.cardNo}</td>
              <td>
                {onRemove && (
                  <button type="button" className="secondary" onClick={() => onRemove(entry.id)}>
                    削除
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export type { EntryTableProps };
export default EntryTable;
