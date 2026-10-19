'use client';

/**
 * Hook de sincronização em tempo real.
 * Assina o endpoint SSE e chama `router.refresh()` quando o banco muda,
 * fazendo com que os Server Components re-busquem os dados automaticamente.
 * Reconecta sozinho com backoff se a conexão cair.
 */
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export type RealtimeStatus = 'connecting' | 'online' | 'offline';

export function useRealtime(options: { enabled?: boolean } = {}) {
  const router = useRouter();
  const [status, setStatus] = useState<RealtimeStatus>('connecting');
  const [lastEventAt, setLastEventAt] = useState<Date | null>(null);
  const enabled = options.enabled ?? true;

  // Evita rajadas de refresh quando várias escritas acontecem de uma vez.
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retry = useRef(0);
  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let disposed = false;

    const scheduleRefresh = () => {
      setLastEventAt(new Date());
      if (pending.current) return;
      pending.current = setTimeout(() => {
        pending.current = null;
        router.refresh();
      }, 250);
    };

    const connect = () => {
      if (disposed) return;
      setStatus('connecting');

      const source = new EventSource('/api/realtime');
      sourceRef.current = source;

      source.addEventListener('connected', () => {
        retry.current = 0;
        setStatus('online');
      });
      source.addEventListener('change', scheduleRefresh);
      source.addEventListener('ping', () => setStatus('online'));

      source.onerror = () => {
        setStatus('offline');
        source.close();
        sourceRef.current = null;
        if (disposed) return;
        // Backoff exponencial limitado a 15s.
        retry.current = Math.min(retry.current + 1, 5);
        const delay = Math.min(1000 * 2 ** retry.current, 15000);
        setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      disposed = true;
      if (pending.current) clearTimeout(pending.current);
      sourceRef.current?.close();
      sourceRef.current = null;
    };
  }, [enabled, router]);

  return { status, lastEventAt, refreshNow: () => router.refresh() };
}

/** Sincroniza toda vez que a aba volta a ficar visível (celular desbloqueado). */
export function useVisibilityRefresh() {
  const router = useRouter();
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') router.refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [router]);
}
