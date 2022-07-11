import Router from 'next/router';

export const pushNewRoute = (path: string) => {
	Router.push(path);
};
