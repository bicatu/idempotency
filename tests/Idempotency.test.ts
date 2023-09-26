import { Idempotency, PersistenceRecord, Config, Persistence, md5 } from '../src/Idempotency';
import { UseCaseAlreadyInProgressError } from '../src/Errors';

// Mock the `Persistence` interface
const mockPersistence: Persistence = {
  add: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  get: jest.fn(),
};

// Create a mock `Config` object
const mockConfig: Config = {
  ttl: 3600,
};

// Create an instance of the `Idempotency` class with the mocked dependencies
const idempotency = new Idempotency(mockPersistence, mockConfig);

describe('Idempotency', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('add', () => {
    it('should add a new record to persistence when the key does not exist', async () => {
      const useCase = 'test';
      const input = { foo: 'bar' };
      const idempotencyKey = md5(JSON.stringify(input));

      (mockPersistence.add as jest.Mock).mockResolvedValueOnce(true);
      await idempotency.add(useCase, input);

      expect(mockPersistence.add).toHaveBeenCalledWith(useCase, idempotencyKey, 'in progress');
    });

    it('should throw UseCaseAlreadyInProgressError when the key exists and the status is in progress', async () => {
      const useCase = 'test';
      const input = { foo: 'bar' };
      const idempotencyKey = md5(JSON.stringify(input));
      const record: PersistenceRecord = { status: 'in progress', resultData: null, expiration: 0 };

      (mockPersistence.add as jest.Mock).mockResolvedValueOnce(false);
      (mockPersistence.get as jest.Mock).mockResolvedValueOnce(record);

      await expect(idempotency.add(useCase, input)).rejects.toThrow(UseCaseAlreadyInProgressError);
      expect(mockPersistence.add).toHaveBeenCalledWith(useCase, idempotencyKey, 'in progress');
      expect(mockPersistence.get).toHaveBeenCalledWith(useCase, idempotencyKey);
    });

    it('should return the result data when the key exists and the status is completed', async () => {
      const useCase = 'test';
      const input = { foo: 'bar' };
      const idempotencyKey = md5(JSON.stringify(input));
      const result = { baz: 'qux' };
      const record: PersistenceRecord = { status: 'completed', resultData: result, expiration: 0 };

      (mockPersistence.add as jest.Mock).mockResolvedValueOnce(false);
      (mockPersistence.get as jest.Mock).mockResolvedValueOnce(record);

      const output = await idempotency.add(useCase, input);

      expect(output).toEqual(result);
      expect(mockPersistence.add).toHaveBeenCalledWith(useCase, idempotencyKey, 'in progress');
      expect(mockPersistence.get).toHaveBeenCalledWith(useCase, idempotencyKey);
    });
  });

  describe('complete', () => {
    it('should update the record status to completed and save the result data', async () => {
      const useCase = 'test';
      const input = { foo: 'bar' };
      const idempotencyKey = md5(JSON.stringify(input));
      const result = { baz: 'qux' };

      await idempotency.complete(useCase, input, result);

      expect(mockPersistence.update).toHaveBeenCalledWith(useCase, idempotencyKey, 'completed', result);
    });
  });

  describe('remove', () => {
    it('should remove the record when the idempotency process has been completed', async () => {
      const useCase = 'test';
      const input = { foo: 'bar' };
      const idempotencyKey = md5(JSON.stringify(input));
      const result = { baz: 'qux' };

      await idempotency.remove(useCase, input);

      expect(mockPersistence.delete).toHaveBeenCalledWith(useCase, idempotencyKey);
    });
  });
});