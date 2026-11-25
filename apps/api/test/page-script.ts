const HASH_ALGORITHM = 'SHA-256';
const MESSAGE_HANDLER_HOST = 'webkit';

export const TEST_SITE_KEY = '1x00000000000000000000AA';

type PageCallback = (argument?: string) => void;

export type PageScriptRun = {
  steps: string[];
  posted: string[];
  state: () => string | undefined;
  pressButton: () => void;
  callback: ({ name, argument }: { name: string; argument?: string }) => void;
  callbackNames: () => string[];
  resets: () => number;
};

export async function sourceHash(source: string): Promise<string> {
  const digest = await crypto.subtle.digest(HASH_ALGORITHM, new TextEncoder().encode(source));
  return `'sha256-${btoa(String.fromCharCode(...new Uint8Array(digest)))}'`;
}

export function inlineSources({ html, pattern }: { html: string; pattern: RegExp }): string[] {
  return [...html.matchAll(pattern)].map((match) => {
    const [, source] = match;
    if (source === undefined) throw new Error('an inline element always has content');
    return source;
  });
}

export function onlyInlineSource({ html, pattern }: { html: string; pattern: RegExp }): string {
  const [source, ...others] = inlineSources({ html, pattern });
  if (source === undefined || others.length > 0) throw new Error('the page has exactly one inline element of that kind');
  return source;
}

export function runPageScript({ script, hash, pathname }: { script: string; hash: string; pathname: string }): PageScriptRun {
  const steps: string[] = [];
  const posted: string[] = [];
  const pressListeners: (() => void)[] = [];
  const resetCalls: string[] = [];
  const button = {
    focus() {
      steps.push('focus');
    },
    addEventListener(_type: string, listener: () => void) {
      pressListeners.push(listener);
    },
  };
  const body = { dataset: {} as Record<string, string> };
  const location = {
    hash,
    pathname,
    set href(target: string) {
      steps.push(`navigate ${target}`);
    },
  };
  const history = {
    replaceState(_state: unknown, _title: string, address: string) {
      steps.push(`replace ${address}`);
    },
  };
  const document = { body, getElementById: () => button };
  const pageWindow: Record<string, unknown> = {
    [MESSAGE_HANDLER_HOST]: { messageHandlers: { turnstile: { postMessage: (message: string) => posted.push(message) } } },
  };
  const turnstile = { reset: () => resetCalls.push('reset') };
  new Function('location', 'history', 'document', 'window', 'turnstile', script)(location, history, document, pageWindow, turnstile);
  return {
    steps,
    posted,
    state: () => body.dataset.state,
    pressButton: () => pressListeners.forEach((listener) => listener()),
    callback: ({ name, argument }) => {
      const callback = pageWindow[name];
      if (typeof callback !== 'function') throw new Error(`the page wired no ${name} callback`);
      (callback as PageCallback)(argument);
    },
    callbackNames: () => Object.keys(pageWindow).filter((name) => name !== MESSAGE_HANDLER_HOST),
    resets: () => resetCalls.length,
  };
}
