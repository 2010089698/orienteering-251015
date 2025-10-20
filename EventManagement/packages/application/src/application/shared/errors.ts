export class EventApplicationError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'EventApplicationError';
  }
}

export class ValidationError extends EventApplicationError {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class EventNotFoundError extends EventApplicationError {
  constructor(eventId: string) {
    super(`Event ${eventId} was not found.`);
    this.name = 'EventNotFoundError';
  }
}

export class RaceNotFoundError extends EventApplicationError {
  constructor(eventId: string, raceId: string) {
    super(`Race ${raceId} was not found in event ${eventId}.`);
    this.name = 'RaceNotFoundError';
  }
}

export class PersistenceError extends EventApplicationError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = 'PersistenceError';
  }
}
