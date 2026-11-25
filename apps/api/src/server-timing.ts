import type { Env } from './env';
import { HttpHeader } from './http-header';
import { HttpStatus } from './http-status';
import { withTimedProjects } from './project-routing';
import { type RecordWait, measured } from './timed-call';

export type RequestTimings = { directoryMs: number; projectMs: number };

const EVENT_STREAM_MEDIA_TYPE = 'text/event-stream';
const DURATION_DIGITS = 1;
const TIMED_STATEMENT_METHODS = new Set<PropertyKey>(['first', 'all', 'run', 'raw']);
const preparedStatements = new WeakMap<object, D1PreparedStatement>();

function preparedStatementOf(statement: D1PreparedStatement): D1PreparedStatement {
  const prepared = preparedStatements.get(statement);
  if (prepared === undefined) throw new Error('the statement was not prepared through the timed directory');
  return prepared;
}

function timedStatement({ statement, record }: { statement: D1PreparedStatement; record: RecordWait }): D1PreparedStatement {
  const timed = new Proxy(statement, {
    get(target, property) {
      const member = Reflect.get(target, property);
      if (typeof member !== 'function') return member;
      if (property === 'bind') return (...values: unknown[]) => timedStatement({ statement: target.bind(...values), record });
      if (TIMED_STATEMENT_METHODS.has(property))
        return (...parameters: unknown[]) => measured({ call: () => Reflect.apply(member, target, parameters), record });
      return member.bind(target);
    },
  });
  preparedStatements.set(timed, statement);
  return timed;
}

function timedDirectory({ directory, record }: { directory: D1Database; record: RecordWait }): D1Database {
  return new Proxy(directory, {
    get(target, property) {
      const member = Reflect.get(target, property);
      if (typeof member !== 'function') return member;
      if (property === 'prepare') return (query: string) => timedStatement({ statement: target.prepare(query), record });
      if (property === 'batch') {
        return (statements: D1PreparedStatement[]) => measured({ call: () => target.batch(statements.map(preparedStatementOf)), record });
      }
      return (...parameters: unknown[]) => measured({ call: () => Reflect.apply(member, target, parameters), record });
    },
  });
}

export function timedEnv(env: Env): { env: Env; timings: RequestTimings } {
  const timings: RequestTimings = { directoryMs: 0, projectMs: 0 };
  const directoryTimedEnv: Env = {
    ...env,
    DIRECTORY: timedDirectory({ directory: env.DIRECTORY, record: (milliseconds) => (timings.directoryMs += milliseconds) }),
  };
  const observedEnv = withTimedProjects({ env: directoryTimedEnv, record: (milliseconds) => (timings.projectMs += milliseconds) });
  return { env: observedEnv, timings };
}

function serverTimingOf({ directoryMs, projectMs }: RequestTimings): string {
  return `directory;dur=${directoryMs.toFixed(DURATION_DIGITS)}, project;dur=${projectMs.toFixed(DURATION_DIGITS)}`;
}

async function answerWithoutStream(response: Response): Promise<Response> {
  const isStream = response.headers.get(HttpHeader.ContentType)?.startsWith(EVENT_STREAM_MEDIA_TYPE) === true;
  if (!isStream) return new Response(response.body, response);
  return new Response(await response.arrayBuffer(), response);
}

export async function serveTimed({ env, serve }: { env: Env; serve: (observedEnv: Env) => Promise<Response> }): Promise<Response> {
  const { env: observedEnv, timings } = timedEnv(env);
  const response = await serve(observedEnv);
  const isUntimed = response.status === HttpStatus.Unauthorized || response.webSocket !== null;
  if (isUntimed) return response;
  const timed = await answerWithoutStream(response);
  timed.headers.set(HttpHeader.ServerTiming, serverTimingOf(timings));
  return timed;
}
