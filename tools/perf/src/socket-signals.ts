import type { ChangeSignals } from './change-feed';

type SocketWithHeaders = new (url: string, init: { headers: Record<string, string> }) => WebSocket;

const SocketWithHeaders = WebSocket as unknown as SocketWithHeaders;
const CHANGED_MESSAGE = 'changed';
const HTTP_SCHEME_PATTERN = /^http/;
const SOCKET_SCHEME = 'ws';

export async function openSocketSignals({
  origin,
  token,
  projectId,
}: {
  origin: string;
  token: string;
  projectId: string;
}): Promise<ChangeSignals> {
  const url = `${origin.replace(HTTP_SCHEME_PATTERN, SOCKET_SCHEME)}/owner/projects/${projectId}/socket`;
  const socket = new SocketWithHeaders(url, { headers: { Authorization: `Bearer ${token}` } });
  const state = { listeners: [] as (() => void)[], unheardChanges: 0 };
  socket.addEventListener('message', (event) => {
    if (event.data !== CHANGED_MESSAGE) return;
    if (state.listeners.length === 0) state.unheardChanges += 1;
    state.listeners.forEach((listener) => listener());
  });
  await new Promise<void>((resolve, reject) => {
    socket.addEventListener('open', () => resolve(), { once: true });
    socket.addEventListener('error', () => reject(new Error('the change feed socket failed')), { once: true });
  });
  return {
    onChanged(listener) {
      state.listeners.push(listener);
      if (state.unheardChanges === 0) return;
      state.unheardChanges = 0;
      listener();
    },
    close: () => socket.close(),
  };
}
