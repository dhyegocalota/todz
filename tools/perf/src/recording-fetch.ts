export type RecordedRequest = { method: string; url: string; pathname: string; search: string; headers: Headers; body: unknown };

export type RecordingFetch = { fetch: typeof fetch; requests: RecordedRequest[] };

function parsedBody(text: string): unknown {
  if (text === '') return null;
  return JSON.parse(text);
}

export function recordingFetch(answer: (request: RecordedRequest) => Response | Promise<Response>): RecordingFetch {
  const requests: RecordedRequest[] = [];
  const recording: typeof fetch = async (input, init) => {
    const request = new Request(input, init);
    const { pathname, search } = new URL(request.url);
    const recorded = {
      method: request.method,
      url: request.url,
      pathname,
      search,
      headers: request.headers,
      body: parsedBody(await request.text()),
    };
    requests.push(recorded);
    return answer(recorded);
  };
  return { fetch: recording, requests };
}
