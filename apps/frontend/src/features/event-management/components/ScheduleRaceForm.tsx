import { type FormEvent, useCallback, useMemo, useState } from 'react';
import { StatusMessage } from '@orienteering/shared-ui';
import type { ScheduleRaceCommand } from '@event-management/application';

interface ScheduleRaceFormProps {
  eventId: string;
  isSubmitting: boolean;
  onSchedule: (command: ScheduleRaceCommand) => Promise<void>;
  onScheduled?: () => void;
}

const initialState = {
  name: '',
  date: '',
};

const createInitialFormState = () => ({ ...initialState });

const ScheduleRaceForm = ({ eventId, isSubmitting, onSchedule, onScheduled }: ScheduleRaceFormProps) => {
  const [form, setForm] = useState(createInitialFormState);
  const [status, setStatus] = useState<{ tone: 'success' | 'critical'; message: string } | null>(null);

  const isValid = useMemo(() => {
    return Boolean(form.name && form.date);
  }, [form]);

  const updateField = useCallback((name: keyof typeof initialState, value: string) => {
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
        const payload: ScheduleRaceCommand = {
          eventId,
          name: form.name,
          date: form.date,
        };
        await onSchedule(payload);
        setStatus({ tone: 'success', message: 'レースをスケジュールしました。' });
        setForm(createInitialFormState());
        onScheduled?.();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'レースのスケジュールに失敗しました。';
        setStatus({ tone: 'critical', message });
      }
    },
    [eventId, form, isSubmitting, isValid, onSchedule, onScheduled],
  );

  return (
    <section className="schedule-race" aria-labelledby="schedule-race-heading">
      <h2 id="schedule-race-heading">レースを追加</h2>
      <form className="schedule-race__form" onSubmit={handleSubmit}>
        <div className="schedule-race__grid">
          <label className="schedule-race__field">
            <span>レース名</span>
            <input type="text" value={form.name} onChange={(event) => updateField('name', event.target.value)} required />
          </label>
          <label className="schedule-race__field">
            <span>レース日</span>
            <input type="date" value={form.date} onChange={(event) => updateField('date', event.target.value)} required />
          </label>
        </div>
        <div className="schedule-race__actions">
          <button type="submit" disabled={!isValid || isSubmitting}>
            {isSubmitting ? '登録中…' : 'レースを登録'}
          </button>
        </div>
        {status ? <StatusMessage tone={status.tone} message={status.message} /> : null}
      </form>
    </section>
  );
};

export default ScheduleRaceForm;
