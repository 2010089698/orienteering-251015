export interface TransactionManager {
  execute<T>(work: () => Promise<T> | T): Promise<T>;
}
