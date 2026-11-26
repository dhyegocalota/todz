# One form language test plan

## Unit (TodzKit, `swift test --package-path apps/macos/TodzKit --filter "FieldStateTests|OwnerAPITests|AppModelTests"`)

- [x] All sixteen combinations of focus, issue, disabled and busy resolve to the state of the precedence busy, disabled, invalid, focused, rest. — evidence: `FieldStateTests`, red as a compile failure before `FieldState` existed, green after
- [x] A `cloud_at_capacity` answer decodes to a pause carrying the server's message. — evidence: `OwnerAPITests` error table row, red before the code, green after
- [x] A queue that meets a pause is kept, sending pauses and the banner shows the message. — evidence: the existing `aDailyCapKeepsEveryQueuedChangePausesSendingAndResumesOnTheNextRefresh`, since the new code decodes to the same `fairUsePaused` error
- [x] The self-host guide address. — evidence: `SelfHostAddressTests`

## Offscreen renders (the app's in-process renderer, light and dark)

- [x] Name sheet: rest, focused, invalid, busy.
- [x] First workspace and picker inside the panel.
- [x] Delete confirmation: disabled, enabled, busy.
- [x] Sign-in: email, invalid, sending, inbox, error, with the limited-spots line.
- [x] Server field in Settings and in the sign-in column.
- [x] Settings chord row recording and its refusal line.
- [x] Connect an Agent: rounded blocks, Revoke, Create Key busy.

## User-visible walk (tester)

- [ ] Focus order, Return and Esc on every sheet and on sign-in.
- [ ] A busy button does not move its neighbours.
- [ ] VoiceOver says an issue once.
- [ ] Reduce Motion crossfades; Increase Contrast thickens the rings; Reduce Transparency makes the panel opaque.

## Coverage honesty

The views are not under unit test: the app target has no test bundle, so they are rendered and read, and the logic they follow lives in TodzKit.
