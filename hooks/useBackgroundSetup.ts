import { useContext } from 'react';
import { BackgroundSetupContext } from '@contexts/backgroundSetup';

export const useBackgroundSetup = () => useContext(BackgroundSetupContext);
