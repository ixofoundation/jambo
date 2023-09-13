import React, { useEffect, useState } from 'react';
import SupaMotoScreens from '@components/SupaMotoScreens';

interface ScreenData {
  name: string;
  component: React.ComponentType<any>;
}

const useSupaMotoScreens = (): ScreenData[] => {
  const [screens, setScreens] = useState<ScreenData[]>([]);

  useEffect(() => {
    // Define an array to hold the promises for dynamically importing screens
    const screenImports: Promise<ScreenData>[] = [];

    // Loop through the screen names and create a promise for each dynamic import
    SupaMotoScreens.forEach((screenName: any) => {
      screenImports.push(
        import(`@components/SupaMotoScreens/${screenName}`).then(module => ({
          name: screenName,
          component: module.default,
        }))
      );
    });

    // Use Promise.all to load all screens asynchronously
    Promise.all(screenImports)
      .then(screensData => {
        // Set the screens in your state
        setScreens(screensData);
      })
      .catch(error => {
        console.error('Error loading screens:', error);
      });
  }, []);

  return screens;
};

export default useSupaMotoScreens;
