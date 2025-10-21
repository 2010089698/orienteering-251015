import { type FormEvent, useCallback, useMemo, useState } from 'react';
import { StatusMessage } from '@orienteering/shared-ui';
import type { CreateEventCommand, EventDto } from '@event-management/application';

interface EventCreateFormProps {
  isSubmitting: boolean;
  onCreate: (command: CreateEventCommand) => Promise<EventDto>;
  onCreated?: (eventId: string) => void;
}

const initialState: CreateEventCommand = {
  name: '',
  startDate: '',
  endDate: '',
  venue: '',
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
    if (!form.name || !form.startDate || !form.endDate || !form.venue) {
      return false;
    }
    const start = new Date(form.startDate);
    const end = new Date(form.endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return false;
    }
    return start.getTime() <= end.getTime();
  }, [form]);

  const updateField = useCallback((name: 'name' | 'startDate' | 'endDate' | 'venue', value: string) => {
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
        const event = await onCreate(payload);
        setStatus({ tone: 'success', message: 'イベントを作成しました。' });
        setForm(createInitialForm());
        onCreated?.(event.id);
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
            <span>イベント名</span>
            <input type="text" value={form.name} onChange={(event) => updateField('name', event.target.value)} required />
          </label>
          <label className="event-create__field">
            <span>開始日</span>
            <input
              type="date"
              value={form.startDate}
              onChange={(event) => updateField('startDate', event.target.value)}
              required
            />
          </label>
          <label className="event-create__field">
            <span>終了日</span>
            <input
              type="date"
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
