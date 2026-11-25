import { describe, expect, test } from 'vitest';
import { AuthenticationVerdict, authenticationOf } from '../../src/day-email/reply-authentication';
import { CLOUDFLARE_RESULTS, CLOUDFLARE_SERVICE, OWNER_DOMAIN, parsedHeadersOf } from '../fixtures/day-email/raw-message';

const PREFIX = 'Authentication-Results:';

function resultsOf(body: string, service = CLOUDFLARE_SERVICE): string {
  return `${PREFIX} ${service}; ${body}`;
}

async function verdictOf(headers: string[]) {
  return authenticationOf(await parsedHeadersOf(headers));
}

describe('authenticationOf passes', () => {
  test("Cloudflare's header with an aligned DKIM and DMARC pass names the domain", async () => {
    expect(await verdictOf([CLOUDFLARE_RESULTS, 'From: owner@gmail.com'])).toEqual({
      verdict: AuthenticationVerdict.Passed,
      domain: OWNER_DOMAIN,
    });
  });

  test('the service and the results in upper case still pass', async () => {
    const headers = [
      resultsOf(
        `SPF=PASS; DKIM=PASS HEADER.D=${OWNER_DOMAIN.toUpperCase()}; DMARC=PASS HEADER.FROM=${OWNER_DOMAIN.toUpperCase()}`,
        'MX.CLOUDFLARE.NET',
      ),
    ];
    expect(await verdictOf(headers)).toEqual({ verdict: AuthenticationVerdict.Passed, domain: OWNER_DOMAIN });
  });

  test('a version after the service, a comment and a quoted property still pass', async () => {
    const headers = [
      `${PREFIX} ${CLOUDFLARE_SERVICE} 1 (Cloudflare; a comment (nested)); dkim=pass header.d="${OWNER_DOMAIN}"; dmarc=pass (policy none) header.from=${OWNER_DOMAIN}`,
    ];
    expect(await verdictOf(headers)).toEqual({ verdict: AuthenticationVerdict.Passed, domain: OWNER_DOMAIN });
  });

  test('a second DKIM result that is unaligned beside an aligned one passes', async () => {
    const headers = [
      resultsOf(`dkim=pass header.d=mailgun.example; dkim=pass header.d=${OWNER_DOMAIN}; dmarc=pass header.from=${OWNER_DOMAIN}`),
    ];
    expect(await verdictOf(headers)).toEqual({ verdict: AuthenticationVerdict.Passed, domain: OWNER_DOMAIN });
  });

  test('a sender-supplied header after the first one is ignored', async () => {
    const headers = [CLOUDFLARE_RESULTS, resultsOf('dmarc=fail', 'evil.test')];
    expect(await verdictOf(headers)).toEqual({ verdict: AuthenticationVerdict.Passed, domain: OWNER_DOMAIN });
  });
});

describe('authenticationOf refuses', () => {
  test.each([
    [
      'spf=pass dkim=none dmarc=pass: an SPF-only pass',
      `spf=pass; dkim=none; dmarc=pass header.from=${OWNER_DOMAIN}`,
      AuthenticationVerdict.DkimNotAligned,
    ],
    [
      'an unaligned DKIM pass',
      `dkim=pass header.d=mailgun.example; dmarc=pass header.from=${OWNER_DOMAIN}`,
      AuthenticationVerdict.DkimNotAligned,
    ],
    ['a DKIM fail', `dkim=fail header.d=${OWNER_DOMAIN}; dmarc=pass header.from=${OWNER_DOMAIN}`, AuthenticationVerdict.DkimNotAligned],
    ['a DKIM pass without a domain', `dkim=pass; dmarc=pass header.from=${OWNER_DOMAIN}`, AuthenticationVerdict.DkimNotAligned],
    ['dmarc=fail', `dkim=pass header.d=${OWNER_DOMAIN}; dmarc=fail header.from=${OWNER_DOMAIN}`, AuthenticationVerdict.DmarcNotPassed],
    ['dmarc=none', `dkim=pass header.d=${OWNER_DOMAIN}; dmarc=none header.from=${OWNER_DOMAIN}`, AuthenticationVerdict.DmarcNotPassed],
    [
      'dmarc=temperror',
      `dkim=pass header.d=${OWNER_DOMAIN}; dmarc=temperror header.from=${OWNER_DOMAIN}`,
      AuthenticationVerdict.DmarcNotPassed,
    ],
    ['no dmarc result', `dkim=pass header.d=${OWNER_DOMAIN}; spf=pass`, AuthenticationVerdict.DmarcNotSingle],
    [
      'two dmarc results, a fail then a pass',
      `dmarc=fail header.from=${OWNER_DOMAIN}; dkim=pass header.d=${OWNER_DOMAIN}; dmarc=pass header.from=${OWNER_DOMAIN}`,
      AuthenticationVerdict.DmarcNotSingle,
    ],
    ['a dmarc pass without header.from', `dkim=pass header.d=${OWNER_DOMAIN}; dmarc=pass`, AuthenticationVerdict.DmarcDomainMissing],
    [
      'a dmarc pass smuggled inside a quoted envelope sender',
      `spf=pass smtp.mailfrom="a;dmarc=pass"@evil.test; dkim=pass header.d=${OWNER_DOMAIN}; dmarc=fail header.from=${OWNER_DOMAIN}`,
      AuthenticationVerdict.DmarcNotPassed,
    ],
    [
      'a dmarc pass inside a comment',
      `spf=pass (smuggled dmarc=pass header.from=${OWNER_DOMAIN}); dkim=pass header.d=${OWNER_DOMAIN}; dmarc=fail header.from=${OWNER_DOMAIN}`,
      AuthenticationVerdict.DmarcNotPassed,
    ],
    [
      'a result with a method that has no equals sign',
      `dkim pass header.d=${OWNER_DOMAIN}; dmarc=pass header.from=${OWNER_DOMAIN}`,
      AuthenticationVerdict.MalformedServiceHeader,
    ],
  ])('%s', async (_name, body, verdict) => {
    expect(await verdictOf([resultsOf(body)])).toEqual({ verdict });
  });

  test("an ARC header claiming a pass beside Cloudflare's fail", async () => {
    const headers = [
      `ARC-Authentication-Results: i=1; ${CLOUDFLARE_SERVICE}; dkim=pass header.d=${OWNER_DOMAIN}; dmarc=pass header.from=${OWNER_DOMAIN}`,
      resultsOf(`dkim=pass header.d=${OWNER_DOMAIN}; dmarc=fail header.from=${OWNER_DOMAIN}`),
    ];
    expect(await verdictOf(headers)).toEqual({ verdict: AuthenticationVerdict.DmarcNotPassed });
  });

  test('an ARC header alone is not a service header', async () => {
    const headers = [`ARC-Authentication-Results: i=1; ${CLOUDFLARE_SERVICE}; dmarc=pass header.from=${OWNER_DOMAIN}`];
    expect(await verdictOf(headers)).toEqual({ verdict: AuthenticationVerdict.MissingServiceHeader });
  });

  test('a service name that only starts with the Cloudflare one', async () => {
    const headers = [
      resultsOf(`dkim=pass header.d=${OWNER_DOMAIN}; dmarc=pass header.from=${OWNER_DOMAIN}`, `${CLOUDFLARE_SERVICE}.evil.test`),
    ];
    expect(await verdictOf(headers)).toEqual({ verdict: AuthenticationVerdict.MissingServiceHeader });
  });

  test("a sender-supplied header before Cloudflare's", async () => {
    const headers = [
      resultsOf(`dkim=pass header.d=${OWNER_DOMAIN}; dmarc=pass header.from=${OWNER_DOMAIN}`, 'evil.test'),
      CLOUDFLARE_RESULTS,
    ];
    expect(await verdictOf(headers)).toEqual({ verdict: AuthenticationVerdict.ServiceHeaderNotFirst });
  });

  test('two headers naming Cloudflare', async () => {
    expect(await verdictOf([CLOUDFLARE_RESULTS, CLOUDFLARE_RESULTS])).toEqual({ verdict: AuthenticationVerdict.DuplicateServiceHeader });
  });

  test('no Authentication-Results header at all', async () => {
    expect(await verdictOf(['From: owner@gmail.com'])).toEqual({ verdict: AuthenticationVerdict.MissingServiceHeader });
  });

  test('a verdict never carries header text', async () => {
    const result = await verdictOf([resultsOf('dmarc=fail header.from=secret.example')]);
    expect(JSON.stringify(result)).not.toContain('secret.example');
  });
});
