import { createContext, useState, useEffect, HTMLAttributes } from 'react';

import localConfig from '@constants/config.json';

export type ConfigInfo = typeof localConfig;

export const ConfigContext = createContext({ config: localConfig });

export const ConfigProvider = ({ children }: HTMLAttributes<HTMLDivElement>) => {
	const [config, setConfig] = useState<ConfigInfo>(localConfig);

	// useEffect(() => {
	// 	const getCategoriesMap = async () => {
	// 		setConfig(localConfig);
	// 	};
	// 	getCategoriesMap();
	// }, []);

	const value = { config };
	return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
};
