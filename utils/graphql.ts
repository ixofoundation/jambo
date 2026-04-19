import { cleanUrlString } from '@utils/url';

export type IRequestResult<ReturnType> = Promise<{
  data?: ReturnType;
  error?: Error | unknown;
}>;

export default async function gqlQuery<TReturn>(
  url: string,
  query: string,
  variables?: Record<string, unknown>,
): IRequestResult<TReturn> {
  try {
    const response = await fetch(cleanUrlString(url + '/graphql'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(variables ? { query, variables } : { query }),
    });
    const data = (await response.json()) as TReturn;

    return { data };
  } catch (error) {
    return { error: error as Error };
  }
}
