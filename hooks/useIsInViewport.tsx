import { useEffect, useMemo, useState } from 'react';

const useIsInViewport = (ref: any, enabled: boolean = true) => {
  const [isIntersecting, setIsIntersecting] = useState(false);

  const observer = useMemo(() => new IntersectionObserver(([entry]) => setIsIntersecting(entry.isIntersecting)), []);

  useEffect(() => {
    if (enabled) {
      observer.observe(ref.current);

      return () => {
        observer.disconnect();
      };
    }
  }, [ref, observer, enabled]);

  return isIntersecting;
};

export default useIsInViewport;
