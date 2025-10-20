import type { ChangeEvent } from 'react';

export interface EventFilterState {
  query: string;
}

interface EventFiltersProps {
  filters: EventFilterState;
  onFiltersChange: (next: EventFilterState) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

const EventFilters = ({ filters, onFiltersChange, onRefresh, isRefreshing }: EventFiltersProps) => {
  const handleQueryChange = (event: ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({ ...filters, query: event.target.value });
  };

  return (
    <section className="event-filters" aria-label="イベントの検索とフィルター">
      <div className="event-filters__row">
        <label className="event-filters__label" htmlFor="event-filter-query">
          検索
        </label>
        <input
          id="event-filter-query"
          type="search"
          value={filters.query}
          onChange={handleQueryChange}
          placeholder="イベント名や会場で検索"
          className="event-filters__input"
        />
        <button type="button" className="event-filters__refresh" onClick={onRefresh} disabled={isRefreshing}>
          {isRefreshing ? '更新中…' : '最新の情報に更新'}
        </button>
      </div>
    </section>
  );
};

export default EventFilters;
