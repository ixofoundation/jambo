export const getCSSVariable = (key: string) => {
  if (typeof window !== 'undefined') {
    return getComputedStyle(document.documentElement).getPropertyValue(key);
  }
};
