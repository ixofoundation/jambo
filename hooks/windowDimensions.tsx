import { useState, useEffect } from 'react';
import { getCSSVariable } from '@utils/styles';

type WindowDimensions = {
  width: number | null;
  height: number | null;
  footerHeight: number;
  headerHeight: number;
};

const getWindowDimensions = (): WindowDimensions => {
  const { innerWidth, innerHeight } = window;
  const headerHeight = Number.parseInt(getCSSVariable('--header-height')?.replace('px', '') ?? '0');
  const footerHeight = Number.parseInt(getCSSVariable('--footer-height')?.replace('px', '') ?? '0');

  return {
    width: innerWidth,
    height: innerHeight,
    headerHeight,
    footerHeight,
  };
};

const useWindowDimensions = (): WindowDimensions => {
  const [windowDimensions, setWindowDimensions] = useState<WindowDimensions>({
    width: null,
    height: null,
    footerHeight: 0,
    headerHeight: 0,
  });

  const handleResize = () => {
    setWindowDimensions(getWindowDimensions());
  };

  useEffect(() => {
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return windowDimensions;
};

export default useWindowDimensions;
