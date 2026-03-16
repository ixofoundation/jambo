export type IRequestResult<ReturnType> = Promise<{
  data?: ReturnType;
  error?: Error | unknown;
}>;

export default async function gqlQuery<TReturn>(url: string, query: string): IRequestResult<TReturn> {
  try {
    const response = await fetch(url + '/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    const data = (await response.json()) as TReturn;

    return { data };
  } catch (error) {
    return { error: error as Error };
  }
}
