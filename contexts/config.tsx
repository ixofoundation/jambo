import { createContext, useState, useEffect, HTMLAttributes } from 'react';

import localConfig from '@constants/config.json';
import { ACTION } from 'types/actions';

type LocalConfig = typeof localConfig;
export type ConfigInfo = Omit<LocalConfig, 'actions'> & { actions: ACTION[] };
export type PartialConfigInfo = Partial<ConfigInfo>;

export const ConfigContext = createContext({ config: localConfig as ConfigInfo, updateConfig: (newConfig: PartialConfigInfo) => {} });

export const ConfigProvider = ({ children }: HTMLAttributes<HTMLDivElement>) => {
	const [config, setConfig] = useState<ConfigInfo>(localConfig);

	const updateConfig = (newConfig: PartialConfigInfo) => setConfig({ ...config, ...newConfig });

	useEffect(() => {
		console.log({ config });
	}, [config]);

	const value = { config, updateConfig };
	return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
};
