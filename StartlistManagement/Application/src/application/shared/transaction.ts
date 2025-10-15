export interface TransactionManager {
  /**
   * Executes the provided unit of work within a transaction boundary.
   * Implementations are responsible for committing or rolling back the
   * transaction depending on whether the work completes successfully.
   */
  execute<T>(work: () => Promise<T> | T): Promise<T>;
}
