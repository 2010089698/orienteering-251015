import { DomainError } from '@startlist-management/domain';

export class StartlistApplicationError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'StartlistApplicationError';
  }
}

export class StartlistNotFoundError extends StartlistApplicationError {
  constructor(startlistId: string) {
    super(`Startlist ${startlistId} was not found.`);
    this.name = 'StartlistNotFoundError';
  }
}

export class InvalidCommandError extends StartlistApplicationError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = 'InvalidCommandError';
  }
}

export class PersistenceError extends StartlistApplicationError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = 'PersistenceError';
  }
}

export const mapToApplicationError = (error: unknown): StartlistApplicationError => {
  if (error instanceof StartlistApplicationError) {
    return error;
  }
  if (error instanceof DomainError) {
    return new InvalidCommandError(error.message, error);
  }
  if (error instanceof Error) {
    return new StartlistApplicationError(error.message, error);
  }
  return new StartlistApplicationError('Unknown application error', error);
};
