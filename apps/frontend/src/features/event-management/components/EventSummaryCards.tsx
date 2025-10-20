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
        <h2>サマリー</h2>
        <dl>
          <div>
            <dt>レース数</dt>
            <dd>{event.races.length}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
};

export default EventSummaryCards;
