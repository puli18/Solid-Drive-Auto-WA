import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { DEMO_MODE } from '@/lib/data';
import { publicEnv } from '@/lib/env';

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
      remove: (id?: string) => void;
    };
    __sdaTurnstileLoad?: Promise<void>;
  }
}

/** Token value used in demo mode (Turnstile is skipped there; the demo actions only check it is non-empty). */
export const DEMO_TURNSTILE_TOKEN = 'demo-preview';

export interface TurnstileHandle {
  /** A fresh, unused token. Tokens are single-use, so a second call resets the widget and waits for a new one. */
  consume(): Promise<string>;
}

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  window.__sdaTurnstileLoad ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Verification failed to load'));
    document.head.appendChild(s);
  });
  return window.__sdaTurnstileLoad;
}

/**
 * Cloudflare Turnstile widget (Firebase mode). Uses VITE_TURNSTILE_SITE_KEY, falling back to the
 * always-pass test key. Renders nothing in demo mode. `onToken` mirrors the current token into form state.
 */
export const Turnstile = forwardRef<TurnstileHandle, { onToken?: (token: string) => void; className?: string }>(
  function Turnstile({ onToken, className }, ref) {
    const el = useRef<HTMLDivElement>(null);
    const widgetId = useRef<string | null>(null);
    const token = useRef<string>('');
    const used = useRef(false);
    const waiters = useRef<((t: string) => void)[]>([]);
    const [error, setError] = useState<string | null>(null);
    const onTokenRef = useRef(onToken);
    onTokenRef.current = onToken;

    const setToken = useCallback((t: string) => {
      token.current = t;
      used.current = false;
      onTokenRef.current?.(t);
      if (t) {
        waiters.current.splice(0).forEach((w) => w(t));
      }
    }, []);

    useEffect(() => {
      if (DEMO_MODE) {
        onTokenRef.current?.(DEMO_TURNSTILE_TOKEN);
        return;
      }
      let cancelled = false;
      loadScript()
        .then(() => {
          if (cancelled || !el.current || !window.turnstile) return;
          widgetId.current = window.turnstile.render(el.current, {
            sitekey: publicEnv.turnstileSiteKey,
            theme: 'auto',
            callback: (t: string) => setToken(t),
            'expired-callback': () => setToken(''),
            'error-callback': () => setError('Verification failed. Please refresh the page and try again.'),
          });
        })
        .catch(() => setError('Verification could not load. Check your connection and refresh.'));
      return () => {
        cancelled = true;
        if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
        widgetId.current = null;
      };
    }, [setToken]);

    useImperativeHandle(
      ref,
      () => ({
        consume() {
          if (DEMO_MODE) return Promise.resolve(DEMO_TURNSTILE_TOKEN);
          if (token.current && !used.current) {
            used.current = true;
            return Promise.resolve(token.current);
          }
          return new Promise<string>((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('Please complete the verification')), 30_000);
            waiters.current.push((t) => {
              clearTimeout(timer);
              used.current = true;
              resolve(t);
            });
            token.current = '';
            onTokenRef.current?.('');
            if (widgetId.current && window.turnstile) window.turnstile.reset(widgetId.current);
          });
        },
      }),
      [],
    );

    if (DEMO_MODE) return null;
    return (
      <div className={className}>
        <div ref={el} className="min-h-[65px]" />
        {error ? (
          <p role="alert" className="text-destructive mt-2 text-sm">
            {error}
          </p>
        ) : null}
      </div>
    );
  },
);
