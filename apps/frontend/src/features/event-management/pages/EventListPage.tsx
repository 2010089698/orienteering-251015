import { useCallback, useEffect, useMemo, useState } from 'react';
import { StatusMessage } from '@orienteering/shared-ui';

import { useEventManagement } from '../state';
import EventFilters, { type EventFilterState } from '../components/EventFilters';
import EventTable from '../components/EventTable';
import EventCreateForm from '../components/EventCreateForm';

const refreshTimeFormatter = new Intl.DateTimeFormat('ja-JP', {
  dateStyle: 'medium',
  timeStyle: 'medium',
});

const defaultFilters: EventFilterState = {
  query: '',
  onlyAllowMultiplePerDay: false,
  onlyAllowOverlap: false,
};

const EventListPage = () => {
  const { events, refreshEvents, isLoading, isMutating, error, createEvent } = useEventManagement();
  const [filters, setFilters] = useState<EventFilterState>(defaultFilters);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const handleRefresh = useCallback(async () => {
    setRefreshError(null);
    try {
      await refreshEvents();
      setLastRefreshed(new Date());
    } catch (refreshErr) {
      const message = refreshErr instanceof Error ? refreshErr.message : 'イベントの取得に失敗しました。';
      setRefreshError(message);
    }
  }, [refreshEvents]);

  useEffect(() => {
    handleRefresh();
  }, [handleRefresh]);

  const filteredEvents = useMemo(() => {
    const query = filters.query.trim().toLowerCase();
    return events.filter((event) => {
      if (filters.onlyAllowMultiplePerDay && !event.allowMultipleRacesPerDay) {
        return false;
      }
      if (filters.onlyAllowOverlap && !event.allowScheduleOverlap) {
        return false;
      }
      if (!query) {
        return true;
      }
      return [event.name, event.venue, event.id].some((value) => value.toLowerCase().includes(query));
    });
  }, [events, filters]);

  return (
    <div className="event-management">
      <header className="event-management__header">
        <div>
          <h1>イベント管理</h1>
          <p>
            全 {filteredEvents.length} 件
            {lastRefreshed ? (
              <>
                {' '}
                / 最終更新: <time dateTime={lastRefreshed.toISOString()}>{refreshTimeFormatter.format(lastRefreshed)}</time>
              </>
            ) : null}
          </p>
        </div>
      </header>
      <div className="event-management__content">
        <div className="event-management__main">
          <EventFilters
            filters={filters}
            onFiltersChange={setFilters}
            onRefresh={handleRefresh}
            isRefreshing={isLoading}
          />
          {error ? <StatusMessage tone="critical" message={error} /> : null}
          {refreshError ? <StatusMessage tone="critical" message={refreshError} /> : null}
          <EventTable events={filteredEvents} isLoading={isLoading} />
        </div>
        <aside className="event-management__aside">
          <EventCreateForm
            isSubmitting={isMutating}
            onCreate={createEvent}
            onCreated={() => {
              setLastRefreshed(new Date());
            }}
          />
        </aside>
      </div>
    </div>
  );
};

export default EventListPage;
