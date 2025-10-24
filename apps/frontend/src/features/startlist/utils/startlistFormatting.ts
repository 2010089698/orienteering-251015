const dateTimeFormatter = new Intl.DateTimeFormat('ja-JP', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const timeFormatter = new Intl.DateTimeFormat('ja-JP', {
  hour: '2-digit',
  minute: '2-digit',
});

export const formatDateTime = (value?: string): string | null => {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return dateTimeFormatter.format(parsed);
};

export const formatTime = (value?: string): string | null => {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return timeFormatter.format(parsed);
};

export const sortStartTimes = <T extends { startTime: string }>(
  startTimes: readonly T[],
): T[] => {
  return [...startTimes].sort((left, right) => {
    const leftTime = new Date(left.startTime).getTime();
    const rightTime = new Date(right.startTime).getTime();
    return leftTime - rightTime;
  });
};
