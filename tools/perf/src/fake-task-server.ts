import { fieldOf, listOf, numberOf, textOf } from './json-reader';
import { type FakeMcpServer, fakeMcpServer } from './fake-mcp-server';

export type FakeTaskServer = FakeMcpServer & { openTasks: () => { number: number; title: string }[] };

const DEFAULT_LIST_LIMIT = 20;

export function fakeTaskServer({
  openTitles = [],
  isLostAdd = () => false,
}: {
  openTitles?: string[];
  isLostAdd?: (title: string) => boolean;
} = {}): FakeTaskServer {
  const tasks = new Map<number, string>(openTitles.map((title, index) => [index + 1, title]));
  const counter = { nextNumber: openTitles.length + 1 };
  const matching = (text: unknown) => [...tasks.entries()].filter(([, title]) => typeof text !== 'string' || title.includes(text));
  const server = fakeMcpServer({
    toolAnswers: {
      list: ({ text, limit }) => {
        const matched = matching(text);
        const shown = matched.slice(0, typeof limit === 'number' ? limit : DEFAULT_LIST_LIMIT);
        return [`Open tasks: ${shown.length} of ${matched.length}`, ...shown.map(([number, title]) => `T-${number} ${title}`)].join('\n');
      },
      add: ({ tasks: drafts }) =>
        listOf(drafts)
          .map((draft) => {
            const title = textOf(fieldOf({ value: draft, name: 'title' }));
            const number = counter.nextNumber++;
            tasks.set(number, title);
            if (isLostAdd(title)) throw new Error('the answer was lost');
            return `Added T-${number} ${title}`;
          })
          .join('\n'),
      done: ({ ids }) =>
        listOf(ids)
          .map((identifier) => {
            const number = numberOf(Number(textOf(identifier).replace('T-', '')));
            tasks.delete(number);
            return `Done T-${number} finished`;
          })
          .join('\n'),
    },
  });
  return { ...server, openTasks: () => [...tasks.entries()].map(([number, title]) => ({ number, title })) };
}
