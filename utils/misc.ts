export const isFulfilled = <T>(p: PromiseSettledResult<T>): p is PromiseFulfilledResult<T> => p.status === 'fulfilled';

export const isRejected = <T>(p: PromiseSettledResult<T>): p is PromiseRejectedResult => p.status === 'rejected';

export const sumArray = (array: number[]): number => array.reduce((result, value) => result + value, 0);

export const validateUrl = (url: string) =>
  /^(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})/g.test(
    url,
  );
