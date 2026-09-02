import { useEffect, useRef, useState } from 'react';

export default function useFitScale(designW, designH) {
  const ref = useRef(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const compute = () => {
      const { clientWidth, clientHeight } = el;
      if (!clientWidth || !clientHeight) return;
      setScale(Math.min(clientWidth / designW, clientHeight / designH, 1.15));
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [designW, designH]);

  return [ref, scale];
}
