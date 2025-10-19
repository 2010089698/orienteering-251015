import { describe, expect, it } from 'vitest';
import {
  ClassAssignmentsNotCompletedError,
  DomainError,
  LaneAssignmentsNotCompletedError,
  StartlistSettingsNotEnteredError,
} from '@startlist-management/domain';
import {
  InvalidCommandError,
  StartlistApplicationError,
  StartlistNotFoundError,
  mapToApplicationError,
} from '../errors.js';

describe('Startlist errors', () => {
  it('returns original application errors', () => {
    const error = new StartlistNotFoundError('missing');
    expect(mapToApplicationError(error)).toBe(error);
  });

  it('wraps domain errors in InvalidCommandError', () => {
    const domainError = new DomainError('domain');
    const appError = mapToApplicationError(domainError);

    expect(appError).toBeInstanceOf(InvalidCommandError);
    expect(appError).toMatchObject({ message: 'domain', cause: domainError });
  });

  it('maps startlist guard errors to InvalidCommandError', () => {
    const guardErrors = [
      new StartlistSettingsNotEnteredError(),
      new LaneAssignmentsNotCompletedError(),
      new ClassAssignmentsNotCompletedError(),
    ];

    guardErrors.forEach((guardError) => {
      const appError = mapToApplicationError(guardError);
      expect(appError).toBeInstanceOf(InvalidCommandError);
      expect(appError).toMatchObject({ message: guardError.message, cause: guardError });
    });
  });

  it('wraps regular errors in StartlistApplicationError', () => {
    const error = new Error('boom');
    const appError = mapToApplicationError(error);

    expect(appError).toBeInstanceOf(StartlistApplicationError);
    expect(appError.cause).toBe(error);
  });

  it('wraps unknown values', () => {
    const appError = mapToApplicationError('unknown');

    expect(appError).toBeInstanceOf(StartlistApplicationError);
    expect(appError.message).toBe('Unknown application error');
  });
});
