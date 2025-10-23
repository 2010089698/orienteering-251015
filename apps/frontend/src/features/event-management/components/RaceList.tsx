import { Link } from 'react-router-dom';
import { Tag } from '@orienteering/shared-ui';
import type { RaceDto } from '@event-management/application';

import StartlistPreview from './StartlistPreview';

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
          const startlistId = race.startlistId ?? null;
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
                    {race.startlistLink ? (
                      <a href={race.startlistLink} target="_blank" rel="noreferrer">
                        スタートリストを表示
                      </a>
                    ) : (
                      <span className="race-list__startlist-note">公開リンクはまだ設定されていません。</span>
                    )}
                    <StartlistPreview
                      startlistId={startlistId}
                      version={race.startlistPublicVersion}
                      updatedAt={race.startlistUpdatedAt}
                    />
                  </div>
                ) : (
                  <div className="race-list__startlist race-list__startlist--empty">
                    <span className="race-list__startlist-status">未公開</span>
                    <span className="race-list__startlist-note">スタートリストはまだ公開されていません。</span>
                  </div>
                )}
              </td>
              <td>
                {startlistCreationLink ? (
                  <Link to={startlistCreationLink}>スタートリストを作成</Link>
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
