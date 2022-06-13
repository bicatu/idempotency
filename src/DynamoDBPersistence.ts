import { DynamoDBClient, UpdateItemCommand, PutItemCommand, GetItemCommand, DeleteItemCommand, DynamoDBServiceException } from "@aws-sdk/client-dynamodb";
import { UnableToRemoveIdempotencyKeyError } from "./Errors";
import { IdempotencyStatus, Persistence } from "./Idempotency";


export type DynamoDBPersistenceConfig = {
    ttl: number;
    tableName: string;
}

export type DynamoDBPersistenceRecord = {
    PK: string;
    SK: string;
    status: IdempotencyStatus;
    resultData: any;
    expiration: number;
}

export class DynamoDBPersistence implements Persistence {
    
    constructor(private readonly client: DynamoDBClient, private readonly config: DynamoDBPersistenceConfig) {}

    async add(useCase: string, key: string, status: IdempotencyStatus): Promise<boolean> {
        const now = new Date().getTime();

        const command = new PutItemCommand({
            TableName: this.config.tableName,
            Item: {
                PK: { S: useCase },
                SK: { S: key },
                status: { S: status },
                expiration: { N: (now + this.config.ttl * 1000).toString() },
                createdAt: { S: new Date().toISOString() },
            },
            ConditionExpression: "(attribute_not_exists(PK) AND attribute_not_exists(SK)) OR (attribute_exists(PK) AND attribute_exists(SK) AND expiration < :now)",
            ExpressionAttributeValues: {
                ":now": { N: now.toString() },
            },
        });
        
        try {
            await this.client.send(command);
        } catch (e) {
            if (e instanceof DynamoDBServiceException && e.name === 'ConditionalCheckFailedException') {
                return false;
            }

            // TODO - think on the other exceptions and perhaps define a generic error to use
            throw e;
        }

        return true;

    }

    async get(useCase: string, key: string): Promise<DynamoDBPersistenceRecord> {
        const getCommand = new GetItemCommand({
            TableName: this.config.tableName,
            Key: {
                PK: { S: useCase },
                SK: { S: key },
            },
        });

        try {
            const item = await this.client.send(getCommand);

            return {
                PK: item.Item.PK.S,
                SK: item.Item.SK.S,
                status: item.Item.status.S as IdempotencyStatus,
                resultData: item.Item.resultData ? JSON.parse(item.Item.resultData.S) : null,
                expiration: parseInt(item.Item.expiration.N),
            };
        } catch (e) {
            // TODO - think on the other exceptions
            throw e;
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
            console.log('deleted');
        } catch (e) {
            if(e instanceof DynamoDBServiceException && e.name === 'ResourceNotFoundException') {
                throw new UnableToRemoveIdempotencyKeyError(useCase, key);
            }
            throw e;
        }
    }
}