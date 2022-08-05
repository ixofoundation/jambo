import Router from 'next/router';

export const pushNewRoute = (path: string) => {
	Router.push(path);
};

export const replaceRoute = (path: string) => {
	Router.replace(path);
};

export const backRoute = () => {
	Router.back();
};
