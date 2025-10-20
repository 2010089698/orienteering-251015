import type { ChangeEvent } from 'react';

export interface EventFilterState {
  query: string;
  onlyAllowMultiplePerDay: boolean;
  onlyAllowOverlap: boolean;
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

  const handleToggle = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = event.target;
    onFiltersChange({ ...filters, [name]: checked });
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
      <div className="event-filters__row">
        <label className="event-filters__checkbox">
          <input
            type="checkbox"
            name="onlyAllowMultiplePerDay"
            checked={filters.onlyAllowMultiplePerDay}
            onChange={handleToggle}
          />
          1日に複数レースを許可するイベントのみ
        </label>
        <label className="event-filters__checkbox">
          <input
            type="checkbox"
            name="onlyAllowOverlap"
            checked={filters.onlyAllowOverlap}
            onChange={handleToggle}
          />
          重複スケジュールを許可するイベントのみ
        </label>
      </div>
    </section>
  );
};

export default EventFilters;
