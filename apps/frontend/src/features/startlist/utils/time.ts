const TOKYO_OFFSET_MS = 9 * 60 * 60 * 1000;

export const toTokyoInputValue = (value?: Date | string): string => {
  if (!value) {
    return '';
  }

  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const tokyoDate = new Date(date.getTime() + TOKYO_OFFSET_MS);
  const year = tokyoDate.getUTCFullYear();
  const month = String(tokyoDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(tokyoDate.getUTCDate()).padStart(2, '0');
  const hours = String(tokyoDate.getUTCHours()).padStart(2, '0');
  const minutes = String(tokyoDate.getUTCMinutes()).padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

export const fromTokyoInputValue = (value: string): string => {
  if (!value) {
    return '';
  }

  const [datePart, timePart] = value.split('T');
  if (!datePart || !timePart) {
    return '';
  }

  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);
  if ([year, month, day, hour, minute].some((part) => !Number.isFinite(part))) {
    return '';
  }

  const tokyoUtcMs = Date.UTC(year, month - 1, day, hour, minute);
  return new Date(tokyoUtcMs - TOKYO_OFFSET_MS).toISOString();
};

export const getNextSundayAtTenJst = (): string => {
  const now = new Date();
  const nowInTokyo = new Date(now.getTime() + TOKYO_OFFSET_MS);
  const dayOfWeek = nowInTokyo.getUTCDay();
  let daysToAdd = (7 - dayOfWeek) % 7;
  if (daysToAdd === 0) {
    daysToAdd = 7;
  }

  const targetUtc = Date.UTC(
    nowInTokyo.getUTCFullYear(),
    nowInTokyo.getUTCMonth(),
    nowInTokyo.getUTCDate() + daysToAdd,
    10,
    0,
    0,
    0,
  );

  return new Date(targetUtc - TOKYO_OFFSET_MS).toISOString();
};

export default {
  toTokyoInputValue,
  fromTokyoInputValue,
  getNextSundayAtTenJst,
};
