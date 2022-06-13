# Idempotency

The goal is to provide helper methods to add idempotency to your code. It will enable you to define an idempotency criteria, check if it is already present in the database and if it is, return the existing object.

It also helps to prevent concurrency issues. If you are using Step Functions in your code they already have a mechanism to provide idempotency.

# Design

Using a persistence mechanism to store the idempotency key, the use case being protected, a maximum TTL to keep the results, the status of the execution and the result of the execution.

Use a conditional expression to check if the idempotency key is already present in the database. If it is, return the existing object.

Upon exception of the execution, remove the idempotency key from the database. 


# Persistence

The goal is to be able to support different persistence mechanisms. It is important to select one that can scale with your application and offers low and predictable latency.

## DynamoDB

The schema is as follows:
PK = use case name

SK = Hash of the input or via custom function

status = in progress, completed

resultData = execution result

expiration = timestamp of the record. It will be removed after the TTL.

# Setup

Run the `docker-compose up` command. It will start a local dynamodb instance.

Run `npm run setup` to create the table. It will drop any existing table with name idempotency and recreate it.

Run `npm run execute` to execute the use case. It will execute the use case and store the result in the database.