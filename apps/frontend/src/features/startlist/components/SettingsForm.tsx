import type { FormEvent } from 'react';
import { StatusMessage } from '@orienteering/shared-ui';

import type { StatusMessageState } from '../state/types';
import type { IntervalOption } from '../hooks/useSettingsForm';

export type SettingsFormProps = {
  startTime: string;
  laneIntervalMs: number;
  playerIntervalMs: number;
  laneCount: number;
  avoidConsecutiveClubs: boolean;
  laneIntervalOptions: IntervalOption[];
  playerIntervalOptions: IntervalOption[];
  status: StatusMessageState;
  onStartTimeChange: (value: string) => void;
  onLaneIntervalChange: (value: number) => void;
  onPlayerIntervalChange: (value: number) => void;
  onLaneCountChange: (value: number) => void;
  onAvoidConsecutiveClubsChange: (value: boolean) => void;
  onSubmit: () => void;
};

const SettingsForm = ({
  startTime,
  laneIntervalMs,
  playerIntervalMs,
  laneCount,
  avoidConsecutiveClubs,
  laneIntervalOptions,
  playerIntervalOptions,
  status,
  onStartTimeChange,
  onLaneIntervalChange,
  onPlayerIntervalChange,
  onLaneCountChange,
  onAvoidConsecutiveClubsChange,
  onSubmit,
}: SettingsFormProps): JSX.Element => {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <section aria-labelledby="settings-heading">
      <header>
        <h2 id="settings-heading">スタートリストの基本情報</h2>
        <p className="muted">
          大会名や開始時刻など、スタートリスト作成に必要な内容を入力してください。すべての時刻は日本時間 (JST) で取り扱われます。
        </p>
      </header>
      <form onSubmit={handleSubmit} className="form-grid" noValidate>
        <label>
          開始時刻
          <input
            type="datetime-local"
            value={startTime}
            onChange={(event) => onStartTimeChange(event.target.value)}
            required
          />
        </label>
        <label>
          レーン内クラス間隔
          <select value={laneIntervalMs} onChange={(event) => onLaneIntervalChange(Number(event.target.value))}>
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
          <select value={playerIntervalMs} onChange={(event) => onPlayerIntervalChange(Number(event.target.value))}>
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
            onChange={(event) => onLaneCountChange(Number(event.target.value))}
          />
        </label>
        <label className="form-checkbox">
          <input
            type="checkbox"
            checked={avoidConsecutiveClubs}
            onChange={(event) => onAvoidConsecutiveClubsChange(event.target.checked)}
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

