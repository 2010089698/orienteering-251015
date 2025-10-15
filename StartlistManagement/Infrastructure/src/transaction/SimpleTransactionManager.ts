import { TransactionManager } from '../../../Application/src/application/shared/transaction.js';

export class SimpleTransactionManager implements TransactionManager {
  async execute<T>(work: () => Promise<T> | T): Promise<T> {
    return await work();
  }
}
