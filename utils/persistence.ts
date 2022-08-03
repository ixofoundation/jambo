export const setLocalStorage = <T>(key: string, value: T) => {
	if (typeof window !== 'undefined') {
		window.localStorage.setItem(key, JSON.stringify(value));
	}
};

export const getLocalStorage = <T>(key: string) => {
	if (typeof window !== 'undefined') {
		const value = window.localStorage.getItem(key);
		if (!value) return;
		return JSON.parse(value) as T;
	}
};
