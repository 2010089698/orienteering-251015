import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { StatusMessage } from '@orienteering/shared-ui';

import { useEventManagement } from '../state';
import EventSummaryCards from '../components/EventSummaryCards';
import RaceList from '../components/RaceList';
import ScheduleRaceForm from '../components/ScheduleRaceForm';

const isNotFoundError = (error: unknown): boolean => {
  if (!error) {
    return false;
  }
  const message = error instanceof Error ? error.message : String(error);
  return /404|not found|見つかりません/i.test(message);
};

const EventDetailPage = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const { selectedEvent, selectEvent, isLoading, isMutating, error, scheduleRace } = useEventManagement();
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!eventId) {
      return;
    }

    if (selectedEvent && selectedEvent.id === eventId) {
      return;
    }

    let cancelled = false;
    const fetchEvent = async () => {
      setLoadError(null);
      setNotFound(false);
      try {
        await selectEvent(eventId);
      } catch (err) {
        if (cancelled) {
          return;
        }
        if (isNotFoundError(err)) {
          setNotFound(true);
        } else {
          const message = err instanceof Error ? err.message : 'イベントの取得に失敗しました。';
          setLoadError(message);
        }
      }
    };

    fetchEvent();

    return () => {
      cancelled = true;
    };
  }, [eventId, selectEvent, selectedEvent]);

  const event = useMemo(() => {
    if (!eventId) {
      return null;
    }
    if (selectedEvent && selectedEvent.id === eventId) {
      return selectedEvent;
    }
    return null;
  }, [eventId, selectedEvent]);

  if (!eventId) {
    return (
      <div className="event-detail__not-found">
        <StatusMessage tone="critical" message="イベントIDが指定されていません。" />
        <p>
          <Link to="/events">イベント一覧に戻る</Link>
        </p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="event-detail__not-found">
        <StatusMessage tone="warning" message="指定されたイベントが見つかりません。" />
        <p>
          <Link to="/events">イベント一覧に戻る</Link>
        </p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="event-detail__not-found">
        <StatusMessage tone="critical" message={loadError} />
        <p>
          <Link to="/events">イベント一覧に戻る</Link>
        </p>
      </div>
    );
  }

  if (!event) {
    return <div className="event-detail__loading">イベント情報を読み込んでいます…</div>;
  }

  return (
    <div className="event-detail">
      <header className="event-detail__header">
        <div>
          <h1>{event.name}</h1>
          <p>
            <Link to="/events">一覧に戻る</Link>
          </p>
        </div>
        <Link to={`/startlist?eventId=${encodeURIComponent(event.id)}`} className="event-detail__startlist-link">
          スタートリスト管理を開く
        </Link>
      </header>
      {error ? <StatusMessage tone="critical" message={error} /> : null}
      <EventSummaryCards event={event} />
      <section className="event-detail__races" aria-labelledby="race-list-heading">
        <div className="event-detail__races-header">
          <h2 id="race-list-heading">レース一覧</h2>
          {isLoading ? <span className="event-detail__loading">更新中…</span> : null}
        </div>
        <RaceList races={event.races} eventId={event.id} />
      </section>
      <div className="event-detail__forms">
        <ScheduleRaceForm
          eventId={event.id}
          isSubmitting={isMutating}
          onSchedule={scheduleRace}
          onScheduled={() => {
            void selectEvent(event.id);
          }}
        />
        <section className="event-detail__startlist-guidance" aria-labelledby="startlist-guidance-heading">
          <h2 id="startlist-guidance-heading">スタートリストの連携</h2>
          <p>
            レースを登録するとスタートリスト管理アプリに自動で初期データが作成されます。必要に応じて
            <Link to={`/startlist?eventId=${encodeURIComponent(event.id)}`}>スタートリスト管理画面</Link>
            を開いて設定や公開作業を進めてください。
          </p>
        </section>
      </div>
    </div>
  );
};

export default EventDetailPage;
