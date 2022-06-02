// Can utilize Netlify Edge functions through Next.js middleware. Limit of 50 ms execution times.

import { NextRequest, NextResponse, NextFetchEvent } from 'next/server';

export async function middleware(req: NextRequest, event: NextFetchEvent) {
	const { nextUrl } = req;
	const message = nextUrl.searchParams.get('message');

	if (message) return NextResponse.json({ message });
	return NextResponse.json({ message: 'Hi' });
}
