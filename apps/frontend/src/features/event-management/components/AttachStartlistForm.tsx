import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { StatusMessage } from '@orienteering/shared-ui';
import type { AttachStartlistCommand, RaceDto } from '@event-management/application';

interface AttachStartlistFormProps {
  eventId: string;
  races: RaceDto[];
  isSubmitting: boolean;
  onAttach: (command: AttachStartlistCommand) => Promise<void>;
  onAttached?: () => void;
  defaultStartlistLink?: string;
  defaultRaceId?: string;
}

const AttachStartlistForm = ({
  eventId,
  races,
  isSubmitting,
  onAttach,
  onAttached,
  defaultStartlistLink,
  defaultRaceId,
}: AttachStartlistFormProps) => {
  const [raceId, setRaceId] = useState(defaultRaceId ?? '');
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

  const submitStartlistLink = useCallback(
    async (link: string) => {
      if (!raceId || !link || isSubmitting) {
        return;
      }

      try {
        await onAttach({ eventId, raceId, startlistLink: link });
        setStatus({ tone: 'success', message: 'スタートリストを連携しました。' });
        setStartlistLink('');
        onAttached?.();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'スタートリストの連携に失敗しました。';
        setStatus({ tone: 'critical', message });
      }
    },
    [eventId, isSubmitting, onAttach, onAttached, raceId],
  );

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!isValid || isSubmitting) {
        return;
      }

      await submitStartlistLink(startlistLink);
    },
    [isSubmitting, isValid, startlistLink, submitStartlistLink],
  );

  const handleAttachDefault = useCallback(() => {
    if (!defaultStartlistLink) {
      return;
    }

    void submitStartlistLink(defaultStartlistLink);
  }, [defaultStartlistLink, submitStartlistLink]);

  useEffect(() => {
    if (!defaultRaceId) {
      return;
    }
    const hasDefault = races.some((race) => race.id === defaultRaceId);
    if (!hasDefault) {
      return;
    }
    setRaceId((current) => (current ? current : defaultRaceId));
  }, [defaultRaceId, races]);

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
          {defaultStartlistLink ? (
            <button
              type="button"
              className="secondary"
              onClick={handleAttachDefault}
              disabled={!raceId || isSubmitting || races.length === 0}
            >
              確定したスタートリストを連携
            </button>
          ) : null}
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
