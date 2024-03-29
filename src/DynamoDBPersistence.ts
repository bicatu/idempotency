import { DynamoDBClient, UpdateItemCommand, GetItemCommand, DeleteItemCommand, DynamoDBServiceException } from "@aws-sdk/client-dynamodb";
import { PeristenceError, UnableToRemoveIdempotencyKeyError, UnknownUseCaseError } from "./Errors";
import { IdempotencyStatus, Persistence, PersistenceRecord } from "./Idempotency";


export type DynamoDBPersistenceConfig = {
    ttl: number;
    tableName: string;
}

export class DynamoDBPersistence implements Persistence {
    
    constructor(private readonly client: DynamoDBClient, private readonly config: DynamoDBPersistenceConfig) {}

    async add(useCase: string, key: string, status: IdempotencyStatus): Promise<boolean> {
        const now = new Date().getTime();

        const command = new UpdateItemCommand({
            TableName: this.config.tableName,
            Key: {
                PK: { S: useCase },
                SK: { S: key },
            },
            UpdateExpression: 'SET #status = :status, #expiration = :expiration, #createdAt = :createdAt',
            ConditionExpression: "(attribute_not_exists(PK) AND attribute_not_exists(SK)) OR (attribute_exists(PK) AND attribute_exists(SK) AND expiration < :now)",
            ExpressionAttributeNames: {
                "#status": "status",
                "#expiration": "expiration",
                "#createdAt": "createdAt",
            },
            ExpressionAttributeValues: {
                ":now": { N: now.toString() },
                ":status": { S: status },
                ":expiration": { N: (now + this.config.ttl * 1000).toString() },
                ":createdAt": { S: new Date().toISOString() },
            },
        });
        
        try {
            await this.client.send(command);
        } catch (e) {
            if (e instanceof DynamoDBServiceException && e.name === 'ConditionalCheckFailedException') {
                return false;
            }
            throw e;
        }

        return true;
    }

    async get(useCase: string, key: string): Promise<PersistenceRecord> {
        const getCommand = new GetItemCommand({
            TableName: this.config.tableName,
            Key: {
                PK: { S: useCase },
                SK: { S: key },
            },
        });

        try {
            const item = await this.client.send(getCommand);

            if (item.Item === undefined) {
                throw new UnknownUseCaseError(useCase, key);
            }

            return {
                status: item.Item.status.S as IdempotencyStatus,
                resultData: item.Item.resultData ? JSON.parse(item.Item.resultData.S) : null,
                expiration: parseInt(item.Item.expiration.N),
            };
        } catch (e) {
            throw new PeristenceError(useCase, key, e.message);
        }
        
    }


    async update(useCase: string, key: string, status: IdempotencyStatus, data: any): Promise<void> {
        const command = new UpdateItemCommand({
            TableName: this.config.tableName,
            Key: {
                PK: { S: useCase },
                SK: { S: key },
            },
            UpdateExpression: "SET #status = :status, #resultData = :resultData",
            ExpressionAttributeNames: {
                "#status": "status",
                "#resultData": "resultData",
            },
            ExpressionAttributeValues: {
                ":status": { S: status },
                ":resultData": { S: JSON.stringify(data) },
            },
            ReturnValues: "ALL_NEW",
            ConditionExpression: "attribute_exists(PK) AND attribute_exists(SK)", 
        });

        try {
            await this.client.send(command);
        } catch (e) {
            if (e instanceof DynamoDBServiceException && e.name === 'ConditionalCheckFailedException') {
                throw new UnableToRemoveIdempotencyKeyError(useCase, key);
            }
            throw e;
        }
    }
    
    async delete(useCase: string, key: string): Promise<void> {
        const command = new DeleteItemCommand({
            TableName: this.config.tableName,
            Key: {
                PK: { S: useCase },
                SK: { S: key },
                },
            }
        );

        try {
            await this.client.send(command);
        } catch (e) {
            if(e instanceof DynamoDBServiceException && e.name === 'ResourceNotFoundException') {
                throw new UnableToRemoveIdempotencyKeyError(useCase, key);
            }
            throw e;
        }
    }
}