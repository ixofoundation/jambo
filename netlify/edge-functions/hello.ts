import { Context } from 'netlify:edge';

export default async (req: Request, { log }: Context) => {
	log('Processing request for', req.url);

	return new Response('Hello world');
};
