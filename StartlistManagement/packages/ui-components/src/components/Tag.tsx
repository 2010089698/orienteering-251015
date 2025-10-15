import clsx from 'clsx';

export type TagTone = 'default' | 'info' | 'success' | 'warning';

const toneToClass: Record<TagTone, string | undefined> = {
  default: undefined,
  info: 'tag--info',
  success: 'tag--success',
  warning: 'tag--warning',
};

export interface TagProps {
  label: string;
  tone?: TagTone;
}

export const Tag = ({ label, tone = 'default' }: TagProps): JSX.Element => {
  return <span className={clsx('tag', toneToClass[tone])}>{label}</span>;
};
