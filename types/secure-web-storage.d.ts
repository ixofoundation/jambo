declare module 'secure-web-storage' {
	interface StorageOptions {
		hash: (key: string) => string;
		encrypt: (data: string) => string;
		decrypt: (data: string) => string;
	}

	class SecureStorage {
		constructor(storage: Storage, options: StorageOptions);
		set(key: string, value: string): void;
		get(key: string): string | null;
		getString(key: string): string;
		delete(key: string): void;
		clearAll(): void;
	}

	export default SecureStorage;
}
