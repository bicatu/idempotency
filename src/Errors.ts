import { IdempotencyStatus } from "./Idempotency";

export type IdempotencyErrorCode = 'IdempotencyKeyAlreadyExists' | 'IdempotencyKeyExpired' | 'IdempotencyKeyNotFound' | 'UnableToRemoveIdempotencyKey' | 'UseCaseAlreadyInProgress' | 'PeristenceError';

export abstract class IdempotencyError extends Error {
    constructor(message: string, public readonly code: IdempotencyErrorCode, public readonly status: IdempotencyStatus, public readonly result?: any) {
        super(message);
    }
} 

export class UnableToRemoveIdempotencyKeyError extends IdempotencyError {
    constructor(public readonly useCase: string, public readonly key: string) {
        super('Unable to remove idempotency key', 'IdempotencyKeyNotFound', 'unknown');
    }
}

export class UseCaseAlreadyInProgressError extends IdempotencyError {
    constructor(public readonly useCase: string, public readonly key: string) {
        super('The use case is already in progress', 'UseCaseAlreadyInProgress', 'in progress', null);
    }
}

export class UnknownUseCaseError extends IdempotencyError {
    constructor(public readonly useCase: string, public readonly key: string) {
        super('Unknown use case', 'IdempotencyKeyNotFound', 'unknown');
    }
}

export class PeristenceError extends IdempotencyError {
    constructor(public readonly useCase: string, public readonly key: string, public readonly persistenceErrorMessage: string) {
        super(persistenceErrorMessage, 'PeristenceError', 'unknown');
    }
}