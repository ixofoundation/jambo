import { useState } from 'react';

export function useRenderScreen(initialScreen: string) {
    const [currentScreen, setCurrentScreen] = useState(initialScreen);

    const switchToScreen = (newScreen: string) => {
        setCurrentScreen(newScreen);
    };

    return { currentScreen, switchToScreen };
}