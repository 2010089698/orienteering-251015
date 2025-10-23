import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { StatusMessage } from '@orienteering/shared-ui';

import { EventManagementProvider, useEventManagement } from '../../event-management/state';
import EventCreateForm from '../../event-management/components/EventCreateForm';
import RaceList from '../../event-management/components/RaceList';
import {
  useStartlistEventContext,
  useStartlistEventLinkStatus,
  useStartlistStartlistId,
  useStartlistSnapshot,
} from '../state/StartlistContext';
import { useStartlistStepGuard } from '../hooks/useStartlistStepGuard';

const ensureErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return 'Unknown error';
  }
};

const formatEventLabel = (
  event: { id: string; name: string; startDate?: string; endDate?: string },
): string => {
  const { id, name, startDate, endDate } = event;
  if (!startDate && !endDate) {
    return `${name}（${id}）`;
  }
  const dateRange = [startDate, endDate].filter(Boolean).join('〜');
  return `${name}（${dateRange || '日程未設定'}）`;
};

const StartlistLinkContent = (): JSX.Element => {
  const {
    events,
    selectedEvent,
    selectedEventId,
    isLoading,
    isMutating,
    error,
    refreshEvents,
    selectEvent,
    createEvent,
  } = useEventManagement();
  const startlistId = useStartlistStartlistId();
  const snapshot = useStartlistSnapshot();
  const eventContext = useStartlistEventContext();
  const eventLinkStatus = useStartlistEventLinkStatus();
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [isInitialLoadComplete, setInitialLoadComplete] = useState(false);
  const autoSelectEventIdRef = useRef<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setRefreshError(null);
      try {
        await refreshEvents();
      } catch (err) {
        if (!isMounted) {
          return;
        }
        setRefreshError(ensureErrorMessage(err) || 'イベントの取得に失敗しました。');
      } finally {
        if (isMounted) {
          setInitialLoadComplete(true);
        }
      }
    };
    void load();

    return () => {
      isMounted = false;
    };
  }, [refreshEvents]);

  const handleRefresh = useCallback(async () => {
    setRefreshError(null);
    try {
      await refreshEvents();
    } catch (err) {
      setRefreshError(ensureErrorMessage(err) || 'イベントの取得に失敗しました。');
    }
  }, [refreshEvents]);

  const handleSelectEvent = useCallback(
    async (eventId: string) => {
      setSelectionError(null);
      try {
        await selectEvent(eventId || null);
      } catch (err) {
        setSelectionError(ensureErrorMessage(err) || 'イベントの取得に失敗しました。');
      }
    },
    [selectEvent],
  );

  useEffect(() => {
    if (!eventContext.eventId) {
      autoSelectEventIdRef.current = null;
      return;
    }
    if (autoSelectEventIdRef.current === eventContext.eventId) {
      return;
    }
    if (selectedEventId) {
      return;
    }
    autoSelectEventIdRef.current = eventContext.eventId;
    void handleSelectEvent(eventContext.eventId);
  }, [eventContext.eventId, handleSelectEvent, selectedEventId]);

  const eventOptions = useMemo(() => {
    return events
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((event) => ({
        id: event.id,
        label: formatEventLabel(event),
      }));
  }, [events]);

  const normalizedStartlistId = startlistId?.trim() ? startlistId.trim() : undefined;
  const defaultStartlistId = eventLinkStatus.startlistId ?? snapshot?.id ?? normalizedStartlistId;

  return (
    <div className="startlist-link">
      <header className="startlist-link__header">
        <div>
          <h1>スタートリストのイベント連携状況</h1>
          <p className="muted">
            スタートリスト ID: <code>{startlistId}</code>
          </p>
        </div>
        <p className="muted">
          レースをイベント管理で登録すると、スタートリスト管理アプリに自動的に連携されます。進捗を確認し、必要に応じてイベント管理ページから詳細を確認してください。
        </p>
      </header>

      <div className="startlist-link__layout">
        <section className="startlist-link__existing" aria-labelledby="startlist-link-existing">
          <div className="startlist-link__section-header">
            <h2 id="startlist-link-existing">既存イベントに紐づけ</h2>
            {isLoading && !isInitialLoadComplete ? <span>読み込み中…</span> : null}
          </div>
          <p className="muted">
            イベントを選ぶと、自動的に連携されたスタートリストの状態が表示されます。
          </p>
          <div className="startlist-link__controls">
            <label>
              <span className="startlist-link__label">イベントを選択</span>
              <select
                value={selectedEventId ?? ''}
                onChange={(event) => {
                  void handleSelectEvent(event.target.value);
                }}
                disabled={isLoading && !isInitialLoadComplete}
              >
                <option value="">イベントを選択してください</option>
                {eventOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                void handleRefresh();
              }}
              disabled={isLoading}
            >
              最新のイベントを取得
            </button>
          </div>
          {selectionError ? <StatusMessage tone="critical" message={selectionError} /> : null}
          {refreshError ? <StatusMessage tone="critical" message={refreshError} /> : null}
          {error ? <StatusMessage tone="critical" message={error} /> : null}
          {eventLinkStatus.status === 'success' && eventLinkStatus.eventId ? (
            <div className="startlist-link__status">
              <StatusMessage
                tone="success"
                message={`イベント「${
                  selectedEvent && selectedEvent.id === eventLinkStatus.eventId
                    ? selectedEvent.name
                    : eventLinkStatus.eventId
                }」にスタートリストを自動連携しました。`}
              />
              <p className="muted">
                <Link to={`/events/${eventLinkStatus.eventId}`}>イベント詳細を開く</Link>
                {' / スタートリスト ID: '}
                <code>{eventLinkStatus.startlistId ?? defaultStartlistId ?? startlistId}</code>
                {eventLinkStatus.startlistLink ? (
                  <>
                    {' / '}
                    <a href={eventLinkStatus.startlistLink} target="_blank" rel="noreferrer">
                      公開URLを確認
                    </a>
                  </>
                ) : null}
              </p>
            </div>
          ) : null}
          {eventLinkStatus.status === 'error' && eventLinkStatus.errorMessage ? (
            <StatusMessage tone="critical" message={eventLinkStatus.errorMessage} />
          ) : null}
          {selectedEvent ? (
            <div className="startlist-link__attach">
              <h3>{selectedEvent.name}</h3>
              <p className="muted">
                <Link to={`/events/${selectedEvent.id}`}>イベント詳細を開く</Link>
              </p>
              <RaceList races={selectedEvent.races ?? []} eventId={selectedEvent.id} />
            </div>
          ) : (
            <p className="muted">イベントを選択すると連携状況が表示されます。</p>
          )}
        </section>

        <section className="startlist-link__new" aria-labelledby="startlist-link-create">
          <h2 id="startlist-link-create">新しいイベントを作成</h2>
          <p className="muted">
            イベントを作成した後、そのイベントにレースを追加するとスタートリストが自動生成されます。
          </p>
          <EventCreateForm
            isSubmitting={isMutating}
            onCreate={createEvent}
            onCreated={(eventId) => {
              void refreshEvents();
              void selectEvent(eventId);
            }}
          />
        </section>
      </div>
    </div>
  );
};

const StartlistLinkPage = (): JSX.Element => {
  useStartlistStepGuard('link');

  return (
    <EventManagementProvider>
      <div className="card">
        <StartlistLinkContent />
      </div>
    </EventManagementProvider>
  );
};

export default StartlistLinkPage;
