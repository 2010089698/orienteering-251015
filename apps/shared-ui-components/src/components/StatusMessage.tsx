import clsx from 'clsx';
import type { ReactNode } from 'react';

export type StatusTone = 'idle' | 'info' | 'success' | 'error';

const toneToClass: Record<StatusTone, string> = {
  idle: 'status--idle',
  info: 'status--info',
  success: 'status--success',
  error: 'status--error',
};

const toneToLabel: Record<StatusTone, string> = {
  idle: '待機中',
  info: '情報',
  success: '成功',
  error: 'エラー',
};

export interface StatusMessageProps {
  tone?: StatusTone;
  message?: string;
  prefixIcon?: ReactNode;
}

export const StatusMessage = ({ tone = 'idle', message, prefixIcon }: StatusMessageProps): JSX.Element => {
  if (!message) {
    return <p className={clsx('status-banner', toneToClass[tone])}> </p>;
  }
  return (
    <p className={clsx('status-banner', toneToClass[tone])} role={tone === 'error' ? 'alert' : 'status'}>
      <span className="status-banner__label">
        {prefixIcon}
        {toneToLabel[tone]}
      </span>
      <span>{message}</span>
    </p>
  );
};
