# Idempotency

The goal is to provide helper methods to add idempotency to your code. It will enable you to define an idempotency criteria, check if it is already present in the database and if it is, return the existing object.

It also helps to prevent concurrency issues. If you are using Step Functions in your code they already have a mechanism to provide idempotency.

## Design

Use of a persistence medium to store a tuple of a use case identifier (example, the name of the use case), an unique execution identifier (idempotency key) to determine if there is already an execution for the same context.

If it is found and the it has been completed, return the result instead of triggering the same execution again.

Additionally we set a time to live (TTL) to make sure we do not keep stale executions forever.

If the execution fails the idempotency key will be removed from the database. This will allow the execution to be retried.

## Persistence

The goal is to be able to support different persistence mechanisms. It is important to select one that can scale with your application and offers low and predictable latency.

### DynamoDB

The schema is as follows:
PK = use case name

SK = The itempotency key.

status = in progress, completed

resultData = execution result

expiration = timestamp of the record. It will be removed after the TTL.

## Setup

Run the `docker-compose up` command. It will start a local dynamodb instance.

Run `npm run setup` to create the table. It will drop any existing table with name idempotency and recreate it.

Run `npm run execute` to execute the use case. It will execute the use case and store the result in the database.
