import { IObjectKeys } from 'types/general';
import { getLocalStorage, setLocalStorage } from './persistence';

// could pass in an array of specific stylesheets for optimization
export const getAllCSSVariableNames = (styleSheets = document.styleSheets) => {
	var cssVars = [];
	for (var i = 0; i < styleSheets.length; i++) {
		try {
			// try/catch used because 'hasOwnProperty' doesn't work
			for (var j = 0; j < styleSheets[i].cssRules.length; j++) {
				try {
					for (var k = 0; k < (styleSheets[i].cssRules[j] as CSSStyleRule).style.length; k++) {
						let name = (styleSheets[i].cssRules[j] as CSSStyleRule).style[k];
						// test name for css variable signature and uniqueness
						if (name.startsWith('--') && cssVars.indexOf(name) == -1) {
							cssVars.push(name);
						}
					}
				} catch (error) {}
			}
		} catch (error) {}
	}
	return cssVars;
};

export const getElementCSSVariables = (allCSSVars: Array<string>, element = document.body) => {
	var elStyles = window.getComputedStyle(element);
	var cssVars: IObjectKeys = {};
	for (var i = 0; i < allCSSVars.length; i++) {
		let key = allCSSVars[i];
		let value = elStyles.getPropertyValue(key).trim();
		if (value) {
			cssVars[key] = value;
		}
	}
	return cssVars;
};

export const getAllVariables = () => {
	if (typeof window !== 'undefined') {
		console.log(':root variables', getElementCSSVariables(getAllCSSVariableNames(), document.documentElement));
		return getElementCSSVariables(getAllCSSVariableNames(), document.documentElement);
	}
};

export const setCSSVariable = (key: string, value: string) => {
	if (typeof window !== 'undefined') {
		document.documentElement.style.setProperty(key, value);
		const variables = getAllVariables();
		if (!variables) return;
		setLocalStorage('cssVariables', variables);
	}
};

export const getCSSVariable = (key: string) => {
	if (typeof window !== 'undefined') {
		return getComputedStyle(document.documentElement).getPropertyValue(key);
	}
};

export const getPersistedCSSVariable = () => {
	if (typeof window !== 'undefined') {
		const variables = getLocalStorage<IObjectKeys>('cssVariables');
		if (!variables) return;
		Object.entries(variables).forEach(([key, value]) => document.documentElement.style.setProperty(key, value?.toString() || null));
	}
};
