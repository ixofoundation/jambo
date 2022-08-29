export const utf16_to_b64 = (str: string) => {
	return Buffer.from(str, 'utf8').toString('base64');
};

// function b64_to_utf8(str) {
// 	return decodeURIComponent(escape(window.atob(str)));
// }
