import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBPersistence } from './src/DynamoDBPersistence';
import { Config, Idempotency, md5 } from './src/Idempotency';
import { IdempotencyError, UseCaseAlreadyInProgressError } from './src/Errors';

type Input = {
    name: string;
    age: number;
    createdAt: Date;
}

type Result = {
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
const myUseCase = (input: Input): Result => {
    console.log('Executing use case: ', input);
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
        age: 19,
        createdAt: new Date()
    };

    let result: Result | undefined;

    try {
        // Start the idempotency process
        result = await idempotency.add<Result>(useCase, input);

        if (result === undefined) {
            // execute the use case
            result = myUseCase(input);
        
            // Complete the idempotency process - we pass the result so it can be stored in the persistence layer
            await idempotency.complete(useCase, input, result);
        }

        // Do your application normal flow and return the result
        console.log('Result => ', result);
    } catch(e) {
        // Either the use case is still in progress or it failed altogether
        if (e.code != 'UseCaseAlreadyInProgress') {
            // Since it is not in progress, the use case failed.
            // We remove the idempotency record so we can try again
            await idempotency.remove(useCase, input);

            // Do your application normal error handling
            console.log('Error: ', e);

            // Return an error indicating the use case failed
            console.log({ code: 500, message: `Internal server error: ${e.message}` });
            return;
        }

        // Return an error indicating the use case is still being executed
        console.log('Use case is still being executed');
        console.log({ code: 409, message: 'Use case is still being executed' });
    } 
})();
