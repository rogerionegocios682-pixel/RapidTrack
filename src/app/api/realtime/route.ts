/**
 * Endpoint de tempo real (Server-Sent Events).
 * ---------------------------------------------------------------------------
 * Cada cliente conectado mantém uma conexão aberta. Quando qualquer escrita
 * acontece no banco (nova corrida, mudança de status, cadastro, mensagem...),
 * o `write()` da camada de dados notifica e este endpoint envia um evento para
 * TODOS os dispositivos conectados, que então revalidam os dados do servidor.
 *
 * Resultado: um operador cadastra uma corrida no computador e o celular
 * atualiza sozinho, sem recarregar a página.
 */
import { getCurrentUser } from '@/lib/auth';
import { subscribe } from '@/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return new Response('Não autorizado', { status: 401 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;

      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        } catch {
          closed = true;
        }
      };

      // Handshake inicial.
      send('connected', { at: new Date().toISOString(), user: user.name });

      // Assina as mudanças do banco.
      const unsubscribe = await subscribe(() => {
        send('change', { at: new Date().toISOString() });
      });

      // Heartbeat mantém a conexão viva através de proxies/keep-alive.
      const heartbeat = setInterval(() => send('ping', { at: Date.now() }), 25_000);

      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          /* já fechado */
        }
      };

      request.signal.addEventListener('abort', cleanup);

      // Teto por conexão; o cliente reconecta automaticamente.
      // Em produção mantém 15 min. Em desenvolvimento usamos um teto curto
      // (~2 min) porque o `next dev` é single-threaded: conexões SSE longas
      // ocupam o event loop e fazem as demais requisições (inclusive o HMR)
      // ficarem enfileiradas — sintoma de "atualizações travando".
      const maxLifetimeMs =
        process.env.NODE_ENV === 'production' ? 15 * 60 * 1000 : 2 * 60 * 1000;
      setTimeout(cleanup, maxLifetimeMs);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
