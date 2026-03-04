import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBPersistence } from './src/DynamoDBPersistence';
import { Config, Idempotency, md5 } from './src/Idempotency';
import { IdempotencyError } from './src/Errors';

type Input = {
    name: string;
    age: number;
    createdAt: Date;
};

type Result = {
    id: number;
    name: string;
    age: number;
};

const config: Config = {
    ttl: 60,
    // Only name + age drive idempotency — createdAt is intentionally excluded
    customHashCalculator: (input: Input) =>
        md5(JSON.stringify({ name: input.name, age: input.age })),
};

const idempotency = new Idempotency(
    new DynamoDBPersistence(
        new DynamoDBClient({
            region: 'us-east-1',
            endpoint: 'http://localhost:8000',
            credentials: { accessKeyId: 'DUMMYIDEXAMPLE', secretAccessKey: 'DUMMYEXAMPLEKEY' },
        }),
        { ttl: config.ttl, tableName: 'idempotency' }
    ),
    config
);

// Simulated use case that succeeds
const myUseCase = (input: Input): Result => {
    console.log('  [use case] Running...', input.name);
    return { id: 1, name: input.name, age: input.age };
};

// Simulated use case that always throws
const myFailingUseCase = (_input: Input): Result => {
    console.log('  [use case] Running... (will throw)');
    throw new Error('Something went wrong');
};

/**
 * Wraps use-case execution with idempotency:
 *  - Returns a cached result when the same input was successfully completed before.
 *  - Cleans up the idempotency record on failure so the caller can safely retry.
 *  - Throws UseCaseAlreadyInProgressError when a concurrent execution is detected.
 */
async function execute(useCase: string, input: Input, fn: (i: Input) => Result): Promise<Result> {
    let result: Result | undefined;

    try {
        result = await idempotency.add<Result>(useCase, input);

        if (result === undefined) {
            result = fn(input);
            await idempotency.complete(useCase, input, result);
        }

        return result;
    } catch (e) {
        if (!IdempotencyError.isAlreadyInProgressError(e)) {
            // Use case failed — remove the in-progress record so retries start fresh
            await idempotency.remove(useCase, input);
        }
        throw e;
    }
}

(async () => {
    const USE_CASE = 'my-use-case';
    const input: Input = { name: 'John Doe', age: 30, createdAt: new Date() };

    // ─────────────────────────────────────────────────────────────────────
    // Scenario 1 — Success
    //   First call  : no stored record → executes the use case and saves result
    //   Second call : same input (different createdAt) → returns cached result,
    //                 use case is NOT executed again
    // ─────────────────────────────────────────────────────────────────────
    console.log('\n── Scenario 1: Success ──────────────────────────────────');

    console.log('First call (no stored record — use case executes):');
    const firstResult = await execute(USE_CASE, input, myUseCase);
    console.log('  Result =>', firstResult);

    // Simulate a retry arriving with a new timestamp — hash still matches (name+age only)
    const retryInput: Input = { ...input, createdAt: new Date() };
    console.log('\nSecond call (same logical input — use case must NOT run again):');
    const secondResult = await execute(USE_CASE, retryInput, myUseCase);
    console.log('  Result =>', secondResult);
    console.log('  ^ Returned from persistence without executing the use case');

    // Clean up before the next scenario
    await idempotency.remove(USE_CASE, input);

    // ─────────────────────────────────────────────────────────────────────
    // Scenario 2 — Failure
    //   First call  : use case throws → in-progress record is cleaned up
    //   Second call : no stale record → fresh execution (safe to retry)
    // ─────────────────────────────────────────────────────────────────────
    console.log('\n── Scenario 2: Failure ──────────────────────────────────');

    console.log('First call (use case throws — record will be removed):');
    try {
        const firstResult = await execute(USE_CASE, input, myFailingUseCase);
        console.log('  Result =>', firstResult);
    } catch (e) {
        console.log('  Error caught:', e.message);
        console.log('  Idempotency record removed — next call starts fresh');
    }

    console.log('\nSecond call (retry — no cached failure, use case runs again):');
    const thirdResult = await execute(USE_CASE, input, myUseCase);
    console.log('  Result =>', thirdResult);
    
})();
