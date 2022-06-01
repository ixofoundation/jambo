import { Context } from 'netlify:edge';

export default async (req: Request, { log, json }: Context) => {
	log('Processing request for', req.url);

	return json('Hello world');
};
