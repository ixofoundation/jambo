import { IObjectKeys } from 'types/general';

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

export const getAllProperties = () => {
	if (typeof window !== 'undefined') {
		console.log(':root variables', getElementCSSVariables(getAllCSSVariableNames(), document.documentElement));
	}
};
