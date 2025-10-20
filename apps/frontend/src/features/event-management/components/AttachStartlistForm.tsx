import { type FormEvent, useCallback, useMemo, useState } from 'react';
import { StatusMessage } from '@orienteering/shared-ui';
import type { AttachStartlistCommand, RaceDto } from '@event-management/application';

interface AttachStartlistFormProps {
  eventId: string;
  races: RaceDto[];
  isSubmitting: boolean;
  onAttach: (command: AttachStartlistCommand) => Promise<void>;
  onAttached?: () => void;
}

const AttachStartlistForm = ({ eventId, races, isSubmitting, onAttach, onAttached }: AttachStartlistFormProps) => {
  const [raceId, setRaceId] = useState('');
  const [startlistLink, setStartlistLink] = useState('');
  const [status, setStatus] = useState<{ tone: 'success' | 'critical'; message: string } | null>(null);

  const isValid = useMemo(() => {
    if (!raceId || !startlistLink) {
      return false;
    }
    try {
      void new URL(startlistLink);
      return true;
    } catch {
      return false;
    }
  }, [raceId, startlistLink]);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!isValid || isSubmitting) {
        return;
      }

      try {
        await onAttach({ eventId, raceId, startlistLink });
        setStatus({ tone: 'success', message: 'スタートリストを連携しました。' });
        setStartlistLink('');
        onAttached?.();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'スタートリストの連携に失敗しました。';
        setStatus({ tone: 'critical', message });
      }
    },
    [eventId, isSubmitting, isValid, onAttach, onAttached, raceId, startlistLink],
  );

  return (
    <section className="attach-startlist" aria-labelledby="attach-startlist-heading">
      <h2 id="attach-startlist-heading">スタートリストを連携</h2>
      <form className="attach-startlist__form" onSubmit={handleSubmit}>
        <label className="attach-startlist__field">
          <span>対象レース</span>
          <select value={raceId} onChange={(event) => setRaceId(event.target.value)} required>
            <option value="" disabled>
              レースを選択してください
            </option>
            {races.map((race) => (
              <option key={race.id} value={race.id}>
                {race.name}
              </option>
            ))}
          </select>
        </label>
        <label className="attach-startlist__field">
          <span>スタートリストURL</span>
          <input
            type="url"
            value={startlistLink}
            onChange={(event) => setStartlistLink(event.target.value)}
            placeholder="https://example.com/startlist"
            required
          />
        </label>
        <div className="attach-startlist__actions">
          <button type="submit" disabled={!isValid || isSubmitting || races.length === 0}>
            {isSubmitting ? '送信中…' : 'スタートリストを設定'}
          </button>
        </div>
        {status ? <StatusMessage tone={status.tone} message={status.message} /> : null}
      </form>
    </section>
  );
};

export default AttachStartlistForm;
