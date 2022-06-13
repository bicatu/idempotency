import { IdempotencyStatus, Persistence } from "./Idempotency";

export class InMemoryPersistence implements Persistence {
    private entries: Map<string, { useCase: string, status: IdempotencyStatus, data: any, ttl: number }> = new Map();

    constructor(private readonly ttl: number) {}

    async add(useCase: string, key: string, status: IdempotencyStatus): Promise<boolean> {
        if (this.entries.has(key)) {
            const entry = this.entries.get(key);
            // @ts-ignore
            throw new IdempotencyError('idempotency key already exists', 'IdempotencyKeyAlreadyExists', entry.status, entry.data);
        } else {
            console.log('add', useCase, key, status, this.ttl);
            this.entries.set(key, { useCase, status, data: null, ttl: this.ttl });
        }

        return true;
    }

    async update(useCase: string, key: string, status: IdempotencyStatus, data: any): Promise<void> {
        let entry = this.entries.get(key);
        if (entry) {
            entry.status = status;
            entry.data = data;
            this.entries.set(key, entry);
        }
    }

    async delete(useCase: string, key: string): Promise<void> {
        console.log('delete', useCase, key);
    }

    async get(useCase: string, key: string): Promise<any> {
        return this.entries.get(key);
    }
}