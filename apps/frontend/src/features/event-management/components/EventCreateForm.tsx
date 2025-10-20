import { type FormEvent, useCallback, useMemo, useState } from 'react';
import { StatusMessage } from '@orienteering/shared-ui';
import type { CreateEventCommand } from '@event-management/application';

interface EventCreateFormProps {
  isSubmitting: boolean;
  onCreate: (command: CreateEventCommand) => Promise<void>;
  onCreated?: (eventId: string) => void;
}

const initialState: CreateEventCommand = {
  eventId: '',
  name: '',
  startDate: '',
  endDate: '',
  venue: '',
  allowMultipleRacesPerDay: false,
  allowScheduleOverlap: false,
};

const createInitialForm = (): CreateEventCommand => ({ ...initialState });

const toIsoString = (value: string): string => {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toISOString();
};

const EventCreateForm = ({ isSubmitting, onCreate, onCreated }: EventCreateFormProps) => {
  const [form, setForm] = useState<CreateEventCommand>(createInitialForm);
  const [status, setStatus] = useState<{ tone: 'success' | 'critical'; message: string } | null>(null);

  const isValid = useMemo(() => {
    if (!form.eventId || !form.name || !form.startDate || !form.endDate || !form.venue) {
      return false;
    }
    const start = new Date(form.startDate);
    const end = new Date(form.endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return false;
    }
    return start.getTime() <= end.getTime();
  }, [form]);

  const updateField = useCallback((name: keyof CreateEventCommand, value: string | boolean) => {
    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }, []);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!isValid || isSubmitting) {
        return;
      }

      try {
        const payload: CreateEventCommand = {
          ...form,
          startDate: toIsoString(form.startDate),
          endDate: toIsoString(form.endDate),
        };
        await onCreate(payload);
        setStatus({ tone: 'success', message: 'イベントを作成しました。' });
        setForm(createInitialForm());
        onCreated?.(payload.eventId);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'イベントの作成に失敗しました。';
        setStatus({ tone: 'critical', message });
      }
    },
    [form, isSubmitting, isValid, onCreate, onCreated],
  );

  return (
    <section className="event-create" aria-labelledby="event-create-heading">
      <h2 id="event-create-heading">新しいイベントを作成</h2>
      <form className="event-create__form" onSubmit={handleSubmit}>
        <div className="event-create__grid">
          <label className="event-create__field">
            <span>イベントID</span>
            <input
              type="text"
              value={form.eventId}
              onChange={(event) => updateField('eventId', event.target.value)}
              required
            />
          </label>
          <label className="event-create__field">
            <span>イベント名</span>
            <input type="text" value={form.name} onChange={(event) => updateField('name', event.target.value)} required />
          </label>
          <label className="event-create__field">
            <span>開始日時</span>
            <input
              type="datetime-local"
              value={form.startDate}
              onChange={(event) => updateField('startDate', event.target.value)}
              required
            />
          </label>
          <label className="event-create__field">
            <span>終了日時</span>
            <input
              type="datetime-local"
              value={form.endDate}
              onChange={(event) => updateField('endDate', event.target.value)}
              required
            />
          </label>
          <label className="event-create__field event-create__field--wide">
            <span>会場</span>
            <input type="text" value={form.venue} onChange={(event) => updateField('venue', event.target.value)} required />
          </label>
        </div>
        <div className="event-create__options">
          <label>
            <input
              type="checkbox"
              checked={Boolean(form.allowMultipleRacesPerDay)}
              onChange={(event) => updateField('allowMultipleRacesPerDay', event.target.checked)}
            />
            1日に複数のレースを許可
          </label>
          <label>
            <input
              type="checkbox"
              checked={Boolean(form.allowScheduleOverlap)}
              onChange={(event) => updateField('allowScheduleOverlap', event.target.checked)}
            />
            レーススケジュールの重複を許可
          </label>
        </div>
        <div className="event-create__actions">
          <button type="submit" disabled={!isValid || isSubmitting}>
            {isSubmitting ? '作成中…' : 'イベントを作成'}
          </button>
        </div>
        {status ? <StatusMessage tone={status.tone} message={status.message} /> : null}
      </form>
    </section>
  );
};

export default EventCreateForm;
