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

export const copyToClipboard = async (text: string) => {
  if (typeof window !== 'undefined') {
    await navigator.clipboard.writeText(text);
  }
};

export const pasteFromClipboard = async (): Promise<void | string> => {
  if (typeof window !== 'undefined') {
    return await navigator.clipboard.readText();
  }
};
