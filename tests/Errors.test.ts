import { IdempotencyError, UnableToRemoveIdempotencyKeyError, UseCaseAlreadyInProgressError, UnknownUseCaseError, PeristenceError } from '../src/Errors';

describe('IdempotencyError', () => {
  test('isAlreadyInProgressError returns true for UseCaseAlreadyInProgressError', () => {
    const error = new UseCaseAlreadyInProgressError('test use case', 'test key');
    expect(IdempotencyError.isAlreadyInProgressError(error)).toBe(true);
  });

  test('isAlreadyInProgressError returns true for error with code UseCaseAlreadyInProgress', () => {
    const error = { code: 'UseCaseAlreadyInProgress' };
    expect(IdempotencyError.isAlreadyInProgressError(error)).toBe(true);
  });

  test('isAlreadyInProgressError returns false for other errors', () => {
    const error = new UnableToRemoveIdempotencyKeyError('test use case', 'test key');
    expect(IdempotencyError.isAlreadyInProgressError(error)).toBe(false);
  });
});

describe('UnableToRemoveIdempotencyKeyError', () => {
  test('constructor sets properties correctly', () => {
    const useCase = 'test use case';
    const key = 'test key';
    const error = new UnableToRemoveIdempotencyKeyError(useCase, key);
    expect(error.message).toBe('Unable to remove idempotency key');
    expect(error.code).toBe('IdempotencyKeyNotFound');
    expect(error.status).toBe('unknown');
    expect(error.useCase).toBe(useCase);
    expect(error.key).toBe(key);
  });
});

describe('UseCaseAlreadyInProgressError', () => {
  test('constructor sets properties correctly', () => {
    const useCase = 'test use case';
    const key = 'test key';
    const error = new UseCaseAlreadyInProgressError(useCase, key);
    expect(error.message).toBe('The use case is already in progress');
    expect(error.code).toBe('UseCaseAlreadyInProgress');
    expect(error.status).toBe('in progress');
    expect(error.useCase).toBe(useCase);
    expect(error.key).toBe(key);
    expect(error.result).toBe(null);
  });
});

describe('UnknownUseCaseError', () => {
  test('constructor sets properties correctly', () => {
    const useCase = 'test use case';
    const key = 'test key';
    const error = new UnknownUseCaseError(useCase, key);
    expect(error.message).toBe('Unknown use case');
    expect(error.code).toBe('IdempotencyKeyNotFound');
    expect(error.status).toBe('unknown');
    expect(error.useCase).toBe(useCase);
    expect(error.key).toBe(key);
  });
});

describe('PeristenceError', () => {
  test('constructor sets properties correctly', () => {
    const useCase = 'test use case';
    const key = 'test key';
    const persistenceErrorMessage = 'test persistence error message';
    const error = new PeristenceError(useCase, key, persistenceErrorMessage);
    expect(error.message).toBe(persistenceErrorMessage);
    expect(error.code).toBe('PeristenceError');
    expect(error.status).toBe('unknown');
    expect(error.useCase).toBe(useCase);
    expect(error.key).toBe(key);
    expect(error.persistenceErrorMessage).toBe(persistenceErrorMessage);
    });
});
