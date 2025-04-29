import axios from 'axios';

export type IRequestResult<ReturnType> = Promise<{
  data?: ReturnType;
  error?: Error | unknown;
}>;

export default async function gqlQuery<TReturn>(url: string, query: string): IRequestResult<TReturn> {
  try {
    const response = await axios.post(
      url + '/graphql',
      {
        query,
      },
      {
        headers: { 'Content-Type': 'application/json' },
      },
    );
    const data = response.data as TReturn;

    return { data };
  } catch (error) {
    return { error: error as Error };
  }
}
