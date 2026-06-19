/**
 * Generic storage interface for persistent data.
 * Used to abstract the underlying storage mechanism (Vault vs Local Device Bucket).
 */
export interface IStore<T> {
	/**
	 * Loads the data from the underlying storage.
	 */
	load(): Promise<T | null>;

	/**
	 * Saves the data to the underlying storage.
	 */
	save(data: T): Promise<void>;
}
