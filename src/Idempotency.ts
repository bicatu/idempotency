import * as crypto from 'crypto';
import { UseCaseAlreadyInProgressError } from './Errors';

export const md5 = (input: string): string => {
    return crypto.createHash('md5').update(input).digest('hex');
  }
  
export type Config = {
      ttl: number;    // in seconds
      customHashCalculator?: (input: any) => string;
  }
  
export type IdempotencyStatus = 'in progress' | 'completed' | 'unknown';
  
export type PersistenceRecord = {
  status: IdempotencyStatus;
  resultData: any;
  expiration: number;
}
export interface Persistence {
      add(useCase: string, key: string, status: IdempotencyStatus): Promise<boolean>;
      update(useCase: string, key: string, status: IdempotencyStatus, data: any): Promise<void>;
      delete(useCase: string, key: string): Promise<void>;
      get(useCase: string, key: string): Promise<any>;
  }

export class Idempotency {
      constructor(private readonly persistence: Persistence, private readonly config: Config) {
      }
  
      private getIdempotencyKey(input: any): string {
          
        if (this.config.customHashCalculator) {
            return this.config.customHashCalculator(input);
        }
  
        return md5(JSON.stringify(input));
      }
  
      async add<T>(useCase: string, input: any): Promise<T> {
        const idempotencyKey = this.getIdempotencyKey(input);

        if (! await this.persistence.add(useCase, idempotencyKey, 'in progress')) {
            // Since we could not add, it is either in progress or completed
            const item = await this.persistence.get(useCase, idempotencyKey);

            if (item.status === 'completed') {
              return item.resultData as T;
            }

            throw new UseCaseAlreadyInProgressError(
                useCase,
                idempotencyKey,
            );
        };
      }
  
      async complete(useCase: string, input: any, result: any): Promise<void> {
        const idempotencyKey = this.getIdempotencyKey(input);
        await this.persistence.update(useCase, idempotencyKey, 'completed', result);
      }
  
      async remove(useCase: string, input: any): Promise<void> {
        const idempotencyKey = this.getIdempotencyKey(input);
        await this.persistence.delete(useCase, idempotencyKey);
      }
  }