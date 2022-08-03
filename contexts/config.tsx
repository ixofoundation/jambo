import { createContext, useState, useEffect, HTMLAttributes } from 'react';

import localConfig from '@constants/config.json';
import { ACTION } from 'types/actions';
import { getLocalStorage, setLocalStorage } from '@utils/persistence';
import { getPersistedCSSVariable } from '@utils/styles';

type LocalConfig = typeof localConfig;
export type ConfigInfo = Omit<LocalConfig, 'actions'> & { actions: ACTION[] };
export type PartialConfigInfo = Partial<ConfigInfo>;

export const ConfigContext = createContext({ config: localConfig as ConfigInfo, updateConfig: (newConfig: PartialConfigInfo) => {} });

export const ConfigProvider = ({ children }: HTMLAttributes<HTMLDivElement>) => {
	const [config, setConfig] = useState<ConfigInfo>(localConfig);

	const updateConfig = (newConfig: PartialConfigInfo) => {
		setConfig({ ...config, ...newConfig });
		setLocalStorage('config', { ...config, ...newConfig });
	};

	useEffect(() => {
		// console.log({ config });
		getPersistedCSSVariable();
		const persistedConfig = getLocalStorage<ConfigInfo>('config');
		if (!persistedConfig) return;
		setConfig(persistedConfig);
	}, []);

	const value = { config, updateConfig };
	return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
};
