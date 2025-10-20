import { Tag } from '@orienteering/shared-ui';
import type { EventDto } from '@event-management/application';

const dateFormatter = new Intl.DateTimeFormat('ja-JP', {
  dateStyle: 'medium',
});

interface EventSummaryCardsProps {
  event: EventDto;
}

const EventSummaryCards = ({ event }: EventSummaryCardsProps) => {
  const start = dateFormatter.format(new Date(event.startDate));
  const end = dateFormatter.format(new Date(event.endDate));

  return (
    <section className="event-summary" aria-label="イベント概要">
      <div className="event-summary__card">
        <h2>イベント情報</h2>
        <dl>
          <div>
            <dt>ID</dt>
            <dd>{event.id}</dd>
          </div>
          <div>
            <dt>名称</dt>
            <dd>{event.name}</dd>
          </div>
          <div>
            <dt>開催期間</dt>
            <dd>
              <time dateTime={event.startDate}>{start}</time> 〜 <time dateTime={event.endDate}>{end}</time>
            </dd>
          </div>
          <div>
            <dt>会場</dt>
            <dd>{event.venue}</dd>
          </div>
        </dl>
      </div>
      <div className="event-summary__card">
        <h2>設定</h2>
        <div className="event-summary__tags">
          <Tag tone={event.allowMultipleRacesPerDay ? 'success' : 'neutral'}>
            {event.allowMultipleRacesPerDay ? '1日に複数レース可' : '1日に1レース'}
          </Tag>
          <Tag tone={event.allowScheduleOverlap ? 'warning' : 'neutral'}>
            {event.allowScheduleOverlap ? '重複スケジュール可' : '重複スケジュール不可'}
          </Tag>
        </div>
        <p>レース数: {event.races.length}</p>
      </div>
    </section>
  );
};

export default EventSummaryCards;
