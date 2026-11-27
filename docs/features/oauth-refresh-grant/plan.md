# OAuth refresh grant: plan

- [x] 1. Red tests in `apps/api/test/oauth/oauth-token.test.ts`, committed alone.
- [x] 2. The refresh spend honours a token spent within the leeway of its first spend, for its own client.
- [x] 3. The spent refresh token cap rises to 10,000.
- [x] 4. ADR 0123, the connect-an-agent page's sentence on rotation.

## Failure modes

| Step | What breaks | Signal | Back out |
|------|-------------|--------|----------|
| 2 | A retry outside the leeway is honoured | the leeway test answers 200 | revert the spend statement |
| 3 | A grant grows past its storage budget | a grant's refresh token count near 10,000 | lower the cap |
