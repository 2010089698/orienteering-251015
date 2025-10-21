import type { FormEvent } from 'react';
import { StatusMessage } from '@orienteering/shared-ui';

import type { StatusMessageState } from '../state/types';
import type { IntervalOption } from '../hooks/useSettingsForm';
import type { SettingsFormFields } from '../hooks/utils/settingsForm';

export type SettingsFormErrors = {
  form: string | null;
};

export type SettingsFormChangeHandlers = {
  eventId: (value: string) => void;
  startTime: (value: string) => void;
  laneIntervalMs: (value: number) => void;
  playerIntervalMs: (value: number) => void;
  laneCount: (value: number) => void;
  avoidConsecutiveClubs: (value: boolean) => void;
};

export type SettingsFormProps = {
  fields: SettingsFormFields;
  errors: SettingsFormErrors;
  laneIntervalOptions: IntervalOption[];
  playerIntervalOptions: IntervalOption[];
  status: StatusMessageState;
  onChange: SettingsFormChangeHandlers;
  onSubmit: () => void;
};

const SettingsForm = ({
  fields,
  errors,
  laneIntervalOptions,
  playerIntervalOptions,
  status,
  onChange,
  onSubmit,
}: SettingsFormProps): JSX.Element => {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  const { eventId, startTime, laneIntervalMs, playerIntervalMs, laneCount, avoidConsecutiveClubs } =
    fields;

  return (
    <section aria-labelledby="settings-heading">
      <header>
        <h2 id="settings-heading">スタートリストの基本情報</h2>
        <p className="muted">
          大会名や開始時刻など、スタートリスト作成に必要な内容を入力してください。すべての時刻は日本時間 (JST) で取り扱われます。
        </p>
      </header>
      <form onSubmit={handleSubmit} className="form-grid" noValidate>
        {errors.form ? (
          <p role="alert" className="form-error">
            {errors.form}
          </p>
        ) : null}
        <label>
          イベントID（必須）
          <input
            type="text"
            value={eventId}
            onChange={(event) => onChange.eventId(event.target.value)}
            required
          />
          <span className="muted">スタートリストと連携する大会の ID を入力してください。</span>
        </label>
        <label>
          開始時刻
          <input
            type="datetime-local"
            value={startTime}
            onChange={(event) => onChange.startTime(event.target.value)}
            required
          />
        </label>
        <label>
          レーン内クラス間隔
          <select value={laneIntervalMs} onChange={(event) => onChange.laneIntervalMs(Number(event.target.value))}>
            {laneIntervalOptions
              .slice()
              .sort((a, b) => a.value - b.value)
              .map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
          </select>
        </label>
        <label>
          クラス内選手間隔
          <select value={playerIntervalMs} onChange={(event) => onChange.playerIntervalMs(Number(event.target.value))}>
            {playerIntervalOptions
              .slice()
              .sort((a, b) => a.value - b.value)
              .map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
          </select>
        </label>
        <label>
          レーン数
          <input
            type="number"
            min={1}
            value={laneCount}
            onChange={(event) => onChange.laneCount(Number(event.target.value))}
          />
        </label>
        <label className="form-checkbox">
          <input
            type="checkbox"
            checked={avoidConsecutiveClubs}
            onChange={(event) => onChange.avoidConsecutiveClubs(event.target.checked)}
          />
          <span>
            同じ所属が連続で並ばないようにする
            <span className="form-checkbox__hint">
              チェックを外すと所属を考慮しない完全ランダムで並び替えます。
            </span>
          </span>
        </label>
      </form>
      <StatusMessage tone={status.level} message={status.text} />
    </section>
  );
};

export default SettingsForm;

