import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBPersistence } from './src/DynamoDBPersistence';
import { InMemoryPersistence } from './src/InMemoryPersistence';
import { Config, Idempotency, IdempotencyStatus, md5, Persistence } from './src/Idempotency';
import { IdempotencyKeyAlreadyExistsError, IdempotencyError } from './src/Errors';

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
        await idempotency.add(useCase, input);
    
        console.log('Executing the use case because I haven\'t seen it before');

        // execute the use case
        result = myUseCase(input);
    
        await idempotency.complete(useCase, input, result);
    } catch(e) {
        if (e.code === 'IdempotencyKeyAlreadyExists') {
            if (e.status === 'completed') {
                console.log('idempotency key already completed');
                result = e.result;
            } else {
                // kicking the bucket down the line... I already executed this use case, but it was not completed
                error = e;
            }
            return;
        }
    
        // if we had an error other than IdempotencyKeyAlreadyExists, we need to remove the idempotency key from the database to allow it to be retried since we did not complete the execution
        await idempotency.remove(useCase, input);

        // other use case errors
        error = e;
    } finally {
        // Here we have to decide. If we have an error it means that the execution is still in progress or other type of error. 
        // If this case should return something we can't do it here.
        // If it is not supposed to return something as the result, we can just notify of the success of the operation

        if (error) {
            // @ts-ignore
            if (error.code === 'IdempotencyKeyAlreadyExists') {
                // We did have the same use case in the database, but it was not completed yet.
                // YOu have to decide what to do here.
                console.log('use case or the same input already started but has not completed yet');
                return;
            }

            // Do your application normal error handling
            // For now just log the error but in the future you can do something else that makes sense to you
            console.log('error', error);
        }

        // If I reached this point it means no error was thrown during the execution, either because it is the first time or because it was already completed
        console.log('result ===> ', result);
        return result;
    }
})();

  