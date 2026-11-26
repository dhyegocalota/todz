# One form language test plan

## Unit (TodzKit, `swift test --package-path apps/macos/TodzKit --filter "FieldStateTests|OwnerAPITests|AppModelTests"`)

- [ ] All sixteen combinations of focus, issue, disabled and busy resolve to the state of the precedence busy, disabled, invalid, focused, rest. — evidence: `FieldStateTests`
- [ ] A `cloud_at_capacity` answer decodes to a pause carrying the server's message. — evidence: `OwnerAPITests`
- [ ] A queue that meets it is kept, sending pauses and the banner shows the message. — evidence: `AppModelTests+Outbox`

## Offscreen renders (the app's in-process renderer, light and dark)

- [ ] Name sheet: rest, focused, invalid, busy.
- [ ] First workspace and picker inside the panel.
- [ ] Delete confirmation: disabled, enabled.
- [ ] Sign-in: email, inbox, error, with the limited-spots line.
- [ ] Server field in Settings and in the sign-in column.
- [ ] Settings chord row recording and its refusal line.
- [ ] Connect an Agent: rounded blocks, Revoke, Create Key busy.

## User-visible walk (tester)

- [ ] Focus order, Return and Esc on every sheet and on sign-in.
- [ ] A busy button does not move its neighbours.
- [ ] VoiceOver says an issue once.
- [ ] Reduce Motion crossfades; Increase Contrast thickens the rings; Reduce Transparency makes the panel opaque.

## Coverage honesty

The views are not under unit test: the app target has no test bundle, so they are rendered and read, and the logic they follow lives in TodzKit.
