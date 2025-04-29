import { useState, useCallback } from 'react';

interface UseStepsReturn {
  step: string | number;
  // eslint-disable-next-line no-unused-vars
  goTo: (step: string | number) => void;
  // eslint-disable-next-line no-unused-vars
  goBack: (step?: string | number) => void;
  // eslint-disable-next-line no-unused-vars
  replace: (step: string | number) => void;
  // eslint-disable-next-line no-unused-vars
  reset: (step?: string | number) => void;
  // eslint-disable-next-line no-unused-vars
  canGoBack: (step?: string | number) => boolean;
  // eslint-disable-next-line no-unused-vars
  canGoTo: (step: string | number) => boolean;
}

/**
 * UseSteps is ideal for managing multi-step forms or screens without
 * having to navigate to different pages.
 * @param steps - Array of possible steps
 * @param initialStep - The initial step to start from
 * @returns { step, goTo, goBack, replace, reset, canGoBack, canGoTo }
 */
const useSteps = (steps: (string | number)[], initialStep?: string | number): UseStepsReturn => {
  const initial = (initialStep && steps.includes(initialStep) ? initialStep : steps[0]) as string | number;
  const [history, setHistory] = useState<(string | number)[]>([initial]);

  const _goTo = useCallback(
    (targetStep: string | number) => {
      if (!steps.includes(targetStep)) {
        console.error(`Step ${targetStep} does not exist in steps ${steps}`);
        return;
      }
      setHistory((prevHistory) => [...prevHistory, targetStep]);
    },
    [steps],
  );

  const _goBack = useCallback(
    (targetStep?: string | number) => {
      if (targetStep !== undefined && targetStep !== null) {
        if (!steps.includes(targetStep)) {
          console.error(`Step ${targetStep} does not exist in steps ${steps}`);
          return;
        }
        if (!history.includes(targetStep)) {
          console.error(`Step ${targetStep} is not in history ${history}`);
          return;
        }
      }
      setHistory((prevHistory) => {
        if (prevHistory.length > 1) {
          return prevHistory.slice(
            0,
            targetStep !== undefined && targetStep !== null ? prevHistory.lastIndexOf(targetStep) : -1,
          );
        }
        return prevHistory;
      });
    },
    [steps, history],
  );

  const _replace = useCallback(
    (targetStep: string | number) => {
      if (!steps.includes(targetStep)) {
        console.error(`Step ${targetStep} does not exist in steps ${steps}`);
        return;
      }
      setHistory((prevHistory) => [...prevHistory.slice(0, -1), targetStep]);
    },
    [steps],
  );

  const _reset = useCallback(
    (targetStep?: string | number) => {
      if (targetStep !== undefined && targetStep !== null && !steps.includes(targetStep)) {
        console.error(`Step ${targetStep} does not exist in steps ${steps}`);
        return;
      }
      setHistory([targetStep ?? initial]);
    },
    [initial, steps],
  );

  const _canGoBack = useCallback(
    (targetStep?: string | number) => {
      return history.length > 1 && (targetStep === undefined || targetStep === null || history.includes(targetStep));
    },
    [history],
  );

  const _canGoTo = useCallback(
    (targetStep: string | number) => {
      return steps.includes(targetStep);
    },
    [steps],
  );

  return {
    step: history[history.length - 1] as string | number,
    goBack: _goBack,
    goTo: _goTo,
    replace: _replace,
    reset: _reset,
    canGoBack: _canGoBack,
    canGoTo: _canGoTo,
  };
};

export default useSteps;
