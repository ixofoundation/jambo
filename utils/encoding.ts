export const utf16_to_b64 = (str: string) => {
	return Buffer.from(str, 'utf8').toString('base64');
};

export const file_to_b64 = (file: File): Promise<string> => {
	return new Promise<string>((resolve, reject) => {
		const reader = new FileReader();
		reader.readAsDataURL(file);
		reader.onload = () => resolve(reader.result?.toString() || '');
		reader.onerror = error => reject(error);
	});
};

// function b64_to_utf8(str) {
// 	return decodeURIComponent(escape(window.atob(str)));
// }
