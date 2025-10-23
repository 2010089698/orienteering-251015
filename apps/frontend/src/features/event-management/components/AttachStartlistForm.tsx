import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { StatusMessage } from '@orienteering/shared-ui';
import type { AttachStartlistCommand, RaceDto } from '@event-management/application';

interface AttachStartlistFormProps {
  eventId: string;
  races: RaceDto[];
  isSubmitting: boolean;
  onAttach: (command: AttachStartlistCommand) => Promise<unknown>;
  onAttached?: () => void;
  defaultStartlistId?: string;
  defaultStartlistLink?: string;
  defaultStartlistUpdatedAt?: string;
  defaultStartlistPublicVersion?: number;
  defaultRaceId?: string;
}

const AttachStartlistForm = ({
  eventId,
  races,
  isSubmitting,
  onAttach,
  onAttached,
  defaultStartlistId,
  defaultStartlistLink,
  defaultStartlistUpdatedAt,
  defaultStartlistPublicVersion,
  defaultRaceId,
}: AttachStartlistFormProps) => {
  const [raceId, setRaceId] = useState(defaultRaceId ?? '');
  const [startlistIdInput, setStartlistIdInput] = useState('');
  const [startlistLinkInput, setStartlistLinkInput] = useState('');
  const [startlistPublicVersionInput, setStartlistPublicVersionInput] = useState('');
  const [status, setStatus] = useState<{ tone: 'success' | 'critical'; message: string } | null>(null);

  const isValid = useMemo(() => {
    const trimmedId = startlistIdInput.trim();
    if (!raceId || !trimmedId) {
      return false;
    }
    const trimmedLink = startlistLinkInput.trim();
    if (trimmedLink) {
      try {
        void new URL(trimmedLink);
      } catch {
        return false;
      }
    }
    const trimmedVersion = startlistPublicVersionInput.trim();
    if (trimmedVersion) {
      const parsed = Number(trimmedVersion);
      if (!Number.isInteger(parsed) || parsed < 1) {
        return false;
      }
    }
    return true;
  }, [raceId, startlistIdInput, startlistLinkInput, startlistPublicVersionInput]);

  const submitStartlistAttachment = useCallback(
    async (payload: Omit<AttachStartlistCommand, 'eventId' | 'raceId'>) => {
      if (!raceId || isSubmitting) {
        return;
      }

      try {
        await onAttach({ eventId, raceId, ...payload });
        setStatus({ tone: 'success', message: 'スタートリストを連携しました。' });
        setStartlistIdInput('');
        setStartlistLinkInput('');
        setStartlistPublicVersionInput('');
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

      const trimmedId = startlistIdInput.trim();
      if (!trimmedId) {
        return;
      }
      const trimmedLink = startlistLinkInput.trim();
      const trimmedVersion = startlistPublicVersionInput.trim();
      const version = trimmedVersion ? Number(trimmedVersion) : undefined;

      const payload: Omit<AttachStartlistCommand, 'eventId' | 'raceId'> = {
        startlistId: trimmedId,
      };

      if (trimmedLink) {
        payload.startlistLink = trimmedLink;
      }
      if (version !== undefined) {
        payload.startlistPublicVersion = version;
      }

      await submitStartlistAttachment(payload);
    },
    [
      isSubmitting,
      isValid,
      startlistIdInput,
      startlistLinkInput,
      startlistPublicVersionInput,
      submitStartlistAttachment,
    ],
  );

  const handleAttachDefault = useCallback(() => {
    if (!defaultStartlistId) {
      return;
    }

    const payload: Omit<AttachStartlistCommand, 'eventId' | 'raceId'> = {
      startlistId: defaultStartlistId,
    };
    if (defaultStartlistLink) {
      payload.startlistLink = defaultStartlistLink;
    }
    if (defaultStartlistUpdatedAt) {
      payload.startlistUpdatedAt = defaultStartlistUpdatedAt;
    }
    if (defaultStartlistPublicVersion) {
      payload.startlistPublicVersion = defaultStartlistPublicVersion;
    }

    void submitStartlistAttachment(payload);
  }, [
    defaultStartlistId,
    defaultStartlistLink,
    defaultStartlistPublicVersion,
    defaultStartlistUpdatedAt,
    submitStartlistAttachment,
  ]);

  useEffect(() => {
    if (!defaultStartlistId) {
      return;
    }
    setStartlistIdInput((current) => (current ? current : defaultStartlistId));
  }, [defaultStartlistId]);

  useEffect(() => {
    if (!defaultStartlistLink) {
      return;
    }
    setStartlistLinkInput((current) => (current ? current : defaultStartlistLink));
  }, [defaultStartlistLink]);

  useEffect(() => {
    if (!defaultStartlistPublicVersion) {
      return;
    }
    setStartlistPublicVersionInput((current) =>
      current ? current : String(defaultStartlistPublicVersion),
    );
  }, [defaultStartlistPublicVersion]);

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
          <span>スタートリストID</span>
          <input
            type="text"
            value={startlistIdInput}
            onChange={(event) => setStartlistIdInput(event.target.value)}
            placeholder="SL-2024-01"
            required
          />
        </label>
        <label className="attach-startlist__field">
          <span>公開バージョン（任意）</span>
          <input
            type="number"
            min={1}
            step={1}
            value={startlistPublicVersionInput}
            onChange={(event) => setStartlistPublicVersionInput(event.target.value)}
            placeholder="1"
          />
        </label>
        <label className="attach-startlist__field">
          <span>公開URL（任意）</span>
          <input
            type="url"
            value={startlistLinkInput}
            onChange={(event) => setStartlistLinkInput(event.target.value)}
            placeholder="https://example.com/startlists/SL-2024-01/v/1"
          />
        </label>
        <div className="attach-startlist__actions">
          {defaultStartlistId && defaultStartlistPublicVersion ? (
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
