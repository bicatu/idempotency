import * as crypto from 'crypto';
import { IdempotencyKeyAlreadyExistsError } from './Errors';

export const md5 = (input: string): string => {
    return crypto.createHash('md5').update(input).digest('hex');
  }
  
export type Config = {
      ttl: number;    // in seconds
      customHashCalculator?: (input: any) => string;
  }
  
export type IdempotencyStatus = 'in progress' | 'completed' | 'unknown';
  
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
  
      async add(useCase: string, input: any): Promise<void> {
        const idempotencyKey = this.getIdempotencyKey(input);

        if (! await this.persistence.add(useCase, idempotencyKey, 'in progress')) {
            const item = await this.persistence.get(useCase, idempotencyKey);

                throw new IdempotencyKeyAlreadyExistsError(
                    useCase,
                    idempotencyKey,
                    item.status, 
                    item.resultData
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