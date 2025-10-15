export interface DomainClock {
  now(): Date;
}

export const SystemClock: DomainClock = {
  now: () => new Date(),
};
