import config from '@constants/config.json';
import { ACTION } from './actions';

type Config = typeof config;
export type ConfigData = Omit<Config, 'actions'> & { actions: ACTION[] };
export type PartialConfigInfo = Partial<ConfigData>;
