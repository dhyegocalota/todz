const HASH_ALGORITHM = 'SHA-256';
const MESSAGE_HANDLER_HOST = 'webkit';
const OPEN_BUTTON_ID = 'open';
const UNDEFINED_TYPE = 'undefined';

export const TEST_SITE_KEY = '1x00000000000000000000AA';
export const WIDGET_ID = 'widget-1';

type PageCallback = (argument?: string) => void;

type PageElement = { dataset: Record<string, string> };

type LoadedScript = { src: string; loadListeners: (() => void)[] };

export type WidgetRender = { container: PageElement; options: Record<string, unknown> };

export type PageScriptRun = {
  steps: string[];
  posted: string[];
  state: () => string | undefined;
  pressButton: () => void;
  callback: ({ name, argument }: { name: string; argument?: string }) => void;
  callbackNames: () => string[];
  resets: () => string[];
  loadedScripts: () => string[];
  loadScripts: () => void;
  renders: () => WidgetRender[];
  widgetCallback: ({ name, argument }: { name: string; argument?: string }) => void;
  leakedNames: () => string[];
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

function onlyRender(renders: WidgetRender[]): WidgetRender {
  const [render, ...others] = renders;
  if (render === undefined || others.length > 0) throw new Error('the page rendered exactly one widget');
  return render;
}

export function runPageScript({
  script,
  hash,
  pathname,
  probedNames = [],
}: {
  script: string;
  hash: string;
  pathname: string;
  probedNames?: string[];
}): PageScriptRun {
  const steps: string[] = [];
  const posted: string[] = [];
  const pressListeners: (() => void)[] = [];
  const resetIds: string[] = [];
  const scripts: LoadedScript[] = [];
  const widgetRenders: WidgetRender[] = [];
  const button = {
    dataset: {},
    focus() {
      steps.push('focus');
    },
    addEventListener(_type: string, listener: () => void) {
      pressListeners.push(listener);
    },
  };
  const check: PageElement = { dataset: { sitekey: TEST_SITE_KEY } };
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
  const document = {
    body,
    head: { appendChild: (element: LoadedScript) => scripts.push(element) },
    getElementById: (id: string) => (id === OPEN_BUTTON_ID ? button : check),
    createElement: () => {
      const element: LoadedScript & { addEventListener: (type: string, listener: () => void) => void } = {
        src: '',
        loadListeners: [],
        addEventListener: (_type, listener) => element.loadListeners.push(listener),
      };
      return element;
    },
  };
  const pageWindow: Record<string, unknown> = {
    [MESSAGE_HANDLER_HOST]: { messageHandlers: { turnstile: { postMessage: (message: string) => posted.push(message) } } },
  };
  const turnstile = {
    render: (container: PageElement, options: Record<string, unknown>) => {
      widgetRenders.push({ container, options });
      return WIDGET_ID;
    },
    reset: (id: string) => resetIds.push(id),
  };
  const probe = `\nreturn [${probedNames.map((name) => `typeof ${name}`).join(', ')}];`;
  const probedTypes = new Function('location', 'history', 'document', 'window', 'turnstile', `${script}${probe}`)(
    location,
    history,
    document,
    pageWindow,
    turnstile,
  ) as string[];
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
    resets: () => resetIds,
    loadedScripts: () => scripts.map((loaded) => loaded.src),
    loadScripts: () => scripts.forEach((loaded) => loaded.loadListeners.forEach((listener) => listener())),
    renders: () => widgetRenders,
    widgetCallback: ({ name, argument }) => {
      const callback = onlyRender(widgetRenders).options[name];
      if (typeof callback !== 'function') throw new Error(`the widget has no ${name} callback`);
      (callback as PageCallback)(argument);
    },
    leakedNames: () => probedNames.filter((_name, index) => probedTypes[index] !== UNDEFINED_TYPE),
  };
}
