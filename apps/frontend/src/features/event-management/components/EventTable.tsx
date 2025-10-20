import { Link } from 'react-router-dom';
import { Tag } from '@orienteering/shared-ui';
import type { EventDto } from '@event-management/application';

const dateFormatter = new Intl.DateTimeFormat('ja-JP', {
  dateStyle: 'medium',
});

interface EventTableProps {
  events: EventDto[];
  isLoading: boolean;
}

const EventTable = ({ events, isLoading }: EventTableProps) => {
  if (isLoading) {
    return <div className="event-table__placeholder">イベント情報を読み込んでいます…</div>;
  }

  if (!events.length) {
    return <div className="event-table__placeholder">イベントが登録されていません。</div>;
  }

  return (
    <table className="event-table">
      <thead>
        <tr>
          <th scope="col">イベント</th>
          <th scope="col">開催期間</th>
          <th scope="col">会場</th>
          <th scope="col">レース数</th>
          <th scope="col">設定</th>
        </tr>
      </thead>
      <tbody>
        {events.map((event) => {
          const start = dateFormatter.format(new Date(event.startDate));
          const end = dateFormatter.format(new Date(event.endDate));
          return (
            <tr key={event.id}>
              <th scope="row">
                <Link to={`/events/${encodeURIComponent(event.id)}`} className="event-table__link">
                  {event.name}
                </Link>
              </th>
              <td>
                <span className="event-table__dates">
                  <time dateTime={event.startDate}>{start}</time> 〜 <time dateTime={event.endDate}>{end}</time>
                </span>
              </td>
              <td>{event.venue}</td>
              <td>{event.races.length}</td>
              <td className="event-table__tags">
                {event.allowMultipleRacesPerDay ? <Tag tone="success">複数レース/日</Tag> : <Tag tone="neutral">1レース/日</Tag>}
                {event.allowScheduleOverlap ? <Tag tone="warning">重複許可</Tag> : <Tag tone="neutral">重複不可</Tag>}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

export default EventTable;
