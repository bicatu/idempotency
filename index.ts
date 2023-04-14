import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBPersistence } from './src/DynamoDBPersistence';
import { Config, Idempotency, md5 } from './src/Idempotency';
import { IdempotencyError, UseCaseAlreadyInProgressError } from './src/Errors';

type Input = {
    name: string;
    age: number;
    createdAt: Date;
}

type Output = {
    id: number;
    name: string;
    age: number;
};

const config: Config = {
    ttl: 10,
    customHashCalculator: (input: Input) => {
        const hash = md5(JSON.stringify({
            name: input.name,
            age: input.age,
        }));

        return hash;
    }
}

const idempotency = new Idempotency(new DynamoDBPersistence(new DynamoDBClient({ region: 'us-east-1', endpoint: 'http://localhost:8000'}), { ttl: config.ttl, tableName: 'idempotency' }), config);

// The use case we would execute
const myUseCase = (input: Input): Output => {
    return {
        id: 1,
        name: input.name,
        age: input.age
    };
}

(async () => {
    console.log('Now: ', new Date().toISOString());
    const useCase = 'my-use-case';
    let input: Input = {
        name: 'John Doe Dorian',
        age: 43,
        createdAt: new Date()
    };

    let result: Output | undefined;
    let error: Error | IdempotencyError | undefined;

    try {
        // Start the idempotency process
        result = await idempotency.add<Output>(useCase, input);

        if (result !== undefined) {
            // execute the use case
            result = myUseCase(input);
        
            // Complete the idempotency process - we pass the result so it can be stored in the persistence layer
            await idempotency.complete(useCase, input, result);
        }

        return result;
    } catch(e) {
        // If we failed because the use case is still being executed we have to return something to the requester to indicate that
        if (! (e instanceof UseCaseAlreadyInProgressError)) {
            // If the idempotency process fails, we remove the record from the persistence layer
            await idempotency.remove(useCase, input);

            // Do your application normal error handling
            console.log('Error: ', e);
            return { code: 500, message: `Internal server error: ${e.message}` };
        }

        // Return an error indicating the use case is still being executed
        console.log('Use case is still being executed');
        return { code: 409, message: 'Use case is still being executed' }
    } 
})();