import { DynamoDBClient, CreateTableCommand, CreateTableCommandInput, DeleteTableCommandInput, DeleteTableCommand } from "@aws-sdk/client-dynamodb";
const REGION = "us-east-1";

const client = new DynamoDBClient({
  region: REGION,
  endpoint: "http://localhost:8000",
  credentials: {
    accessKeyId: "DUMMYIDEXAMPLE",
    secretAccessKey: "DUMMYEXAMPLEKEY",
  },
});

const createTable = async () => {
  const params: CreateTableCommandInput = {
    TableName: "idempotency",
    AttributeDefinitions: [
        { AttributeName: "PK", AttributeType: "S" },
        { AttributeName: "SK", AttributeType: "S" },
    ],
    KeySchema: [
        { AttributeName: "PK", KeyType: "HASH" },
        { AttributeName: "SK", KeyType: "RANGE" },
    ],
    ProvisionedThroughput: {
        ReadCapacityUnits: 1,
        WriteCapacityUnits: 1,
    },
  };

  const data = await client.send(new CreateTableCommand(params));
  console.log("Table Created", data);
  return data;
}

const deleteTable = async () => {
  const params: DeleteTableCommandInput = {
    TableName: "idempotency",
  };

  const data = await client.send(new DeleteTableCommand(params));
  console.log("Table Deleted", data);
  return data;
}

const run = async () => {
    try {
      await deleteTable();
    } catch (err: any) {
      if (err.__type !== "com.amazonaws.dynamodb.v20120810#ResourceNotFoundException") {
        console.log("Error deleting table", err);
        process.exit(1);
      }
    }
    try {
      await createTable();
    } catch (err) {
      console.log("Error creating table", err);
      process.exit(1);
    }
  };

run();
