import { describe, expect, it } from 'vitest';
import { DomainError } from '@startlist-management/domain';
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
