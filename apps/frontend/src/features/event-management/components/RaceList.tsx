import { Link } from 'react-router-dom';
import { Tag } from '@orienteering/shared-ui';
import type { RaceDto } from '@event-management/application';

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
                {race.startlistLink ? (
                  <a href={race.startlistLink} target="_blank" rel="noreferrer">
                    スタートリストを表示
                  </a>
                ) : (
                  '未設定'
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
