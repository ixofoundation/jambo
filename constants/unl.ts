export const getUNLMapApiKey = (): string =>
  process.env.NEXT_PUBLIC_UNL_MAP_API_KEY || '';

export const getUNLMapVpmId = (): string =>
  process.env.NEXT_PUBLIC_UNL_MAP_VPM_ID || '';

export const hasUNLConfig = (): boolean =>
  !!getUNLMapApiKey() && !!getUNLMapVpmId();
