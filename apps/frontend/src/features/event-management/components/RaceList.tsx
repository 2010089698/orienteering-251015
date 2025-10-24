import { Link } from 'react-router-dom';
import { Tag } from '@orienteering/shared-ui';
import type { RaceDto } from '@event-management/application';

import StartlistPreview from './StartlistPreview';
import { getStartlistStatusLabel } from '../utils/startlistStatus';

const dateTimeFormatter = new Intl.DateTimeFormat('ja-JP', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

interface RaceListProps {
  races: RaceDto[];
  eventId?: string;
}

const RaceList = ({ races, eventId }: RaceListProps) => {
  if (!races.length) {
    return <div className="race-list__placeholder">レースがまだスケジュールされていません。</div>;
  }

  return (
    <table className="race-list">
      <thead>
        <tr>
          <th scope="col">レース</th>
          <th scope="col">開始</th>
          <th scope="col">終了</th>
          <th scope="col">状態</th>
          <th scope="col">スタートリスト</th>
          <th scope="col">操作</th>
        </tr>
      </thead>
      <tbody>
        {races.map((race) => {
          const start = dateTimeFormatter.format(new Date(race.schedule.start));
          const end = race.schedule.end ? dateTimeFormatter.format(new Date(race.schedule.end)) : '-';
          const startlistCreationLink = eventId
            ? `/startlist?eventId=${encodeURIComponent(eventId)}&raceId=${encodeURIComponent(race.id)}`
            : undefined;
          const startlistId = race.startlist?.id ?? null;
          const startlistStatus = getStartlistStatusLabel(race.startlist?.status);
          const startlistViewerPath = startlistId
            ? `/startlists/${encodeURIComponent(startlistId)}`
            : null;
          return (
            <tr key={race.id}>
              <th scope="row">{race.name}</th>
              <td>
                <time dateTime={race.schedule.start}>{start}</time>
              </td>
              <td>{race.schedule.end ? <time dateTime={race.schedule.end}>{end}</time> : '-'}</td>
              <td className="race-list__tags">
                {race.duplicateDay ? <Tag tone="warning">同一日</Tag> : <Tag tone="success">日程OK</Tag>}
                {race.overlapsExisting ? <Tag tone="critical">時間重複</Tag> : <Tag tone="success">重複なし</Tag>}
              </td>
              <td>
                {startlistId ? (
                  <div className="race-list__startlist">
                    <div className="race-list__startlist-meta">
                      <span className="race-list__startlist-id">ID: {startlistId}</span>
                      {startlistStatus ? (
                        <span className="race-list__startlist-status">状態: {startlistStatus}</span>
                      ) : null}
                    </div>
                    <StartlistPreview startlistId={startlistId} initialStatus={race.startlist?.status} />
                    {startlistViewerPath ? (
                      <div className="race-list__startlist-actions">
                        <Link to={startlistViewerPath}>ビューアーを開く</Link>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="race-list__startlist race-list__startlist--empty">
                    <span className="race-list__startlist-status">準備中</span>
                    <span className="race-list__startlist-note">スタートリストを自動生成しています。</span>
                  </div>
                )}
              </td>
              <td>
                {startlistCreationLink ? (
                  <Link to={startlistCreationLink}>スタートリストを編集</Link>
                ) : (
                  '—'
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

export default RaceList;
