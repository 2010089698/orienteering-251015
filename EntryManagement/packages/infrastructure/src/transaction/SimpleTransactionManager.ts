import { TransactionManager } from '@entry-management/application';

export class SimpleTransactionManager implements TransactionManager {
  async execute<T>(work: () => Promise<T> | T): Promise<T> {
    return await work();
  }
}
