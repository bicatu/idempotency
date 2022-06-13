import { IdempotencyStatus } from "./Idempotency";

export type IdempotencyErrorCode = 'IdempotencyKeyAlreadyExists' | 'IdempotencyKeyExpired' | 'IdempotencyKeyNotFound';

export class IdempotencyError extends Error {
    constructor(message: string, public readonly code: IdempotencyErrorCode, public readonly status: IdempotencyStatus, public readonly result?: any) {
        super(message);
    }
} 

export class IdempotencyKeyAlreadyExistsError extends IdempotencyError {
    constructor(public readonly useCase: string, public readonly key: string, public readonly status: IdempotencyStatus, public readonly result: any) {
        super('The use case has already been executed with the same idempotency key', 'IdempotencyKeyAlreadyExists', status, result);
    }
}

export class UnableToRemoveIdempotencyKeyError extends IdempotencyError {
    constructor(public readonly useCase: string, public readonly key: string) {
        super('Unable to remove idempotency key', 'IdempotencyKeyNotFound', 'unknown');
    }
}