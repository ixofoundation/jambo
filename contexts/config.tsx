import { createContext, useState, useEffect, HTMLAttributes } from 'react';

import localConfig from '@constants/config.json';

export type ConfigInfo = typeof localConfig;
export type PartialConfigInfo = Partial<ConfigInfo>;

export const ConfigContext = createContext({ config: localConfig, updateConfig: (newConfig: PartialConfigInfo) => {} });

export const ConfigProvider = ({ children }: HTMLAttributes<HTMLDivElement>) => {
	const [config, setConfig] = useState<ConfigInfo>(localConfig);

	const updateConfig = (newConfig: PartialConfigInfo) => setConfig({ ...config, ...newConfig });

	useEffect(() => {
		console.log({ config });
	}, [config]);

	const value = { config, updateConfig };
	return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
};
