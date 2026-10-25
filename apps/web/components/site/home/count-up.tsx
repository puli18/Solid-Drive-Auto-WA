import { useEffect, useRef, useState } from 'react';
import { animate, useInView, useReducedMotion } from 'motion/react';

/**
 * Number that counts up when scrolled into view. SSR renders the final value (no blank state);
 * the count only arms if the element starts below the fold and motion is allowed.
 */
export function CountUp({
  value,
  prefix = '',
  suffix = '',
  className,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '0px 0px -12% 0px' });
  const reduce = useReducedMotion();
  const [armed, setArmed] = useState(false);
  const format = (n: number) => `${prefix}${Math.round(n).toLocaleString('en-AU')}${suffix}`;

  useEffect(() => {
    const el = ref.current;
    if (!el || reduce) return;
    if (el.getBoundingClientRect().top > window.innerHeight) {
      el.textContent = format(0);
      setArmed(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !armed || !inView) return;
    const controls = animate(0, value, {
      duration: 1.6,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => {
        el.textContent = format(v);
      },
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [armed, inView, value]);

  return (
    <span ref={ref} className={className}>
      {format(value)}
    </span>
  );
}
