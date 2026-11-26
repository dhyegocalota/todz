# 0106. The count rolls in template frames, new rows spring in by identity and the title flies by measured origin

- Status: Accepted (the loop's call)
- Date: 2026-11-26
- Deciders: Claude (the build loop's call, closing the three gaps ADR 0077 listed)
- Inspired by: [0077](0077-the-motion-system-is-one-token-set-in-todzkit-with-every-effect-under-350-ms-and-a-crossfade-under-reduce-motion.md), [0071](0071-the-menu-bar-ribbon-unfolds-what-is-next-beside-the-glyph-for-a-few-seconds-as-template-frames-behind-a-setting-off-by-default.md), [0065](0065-the-day-temperature-steps-the-menu-bar-count-s-opacity-after-noon-and-washes-overdue-widget-rows-by-age-behind-a-setting.md)

The loop's call: the menu bar count rolls as a series of template images, the way the ribbon moves, because the status item drops SwiftUI animation: a coordinator in TodzKit plays `CountRoll.frames` (the `bloom` token's duration at the ribbon's frame rate, so under the 350 ms ceiling) and both counts are drawn in the width of the wider one so the item resizes only when the roll ends; under Reduce Motion the same frames only crossfade, decided by `MotionRule`. A new row springs in by `todzEntrance(isEntering:)`, which reads its flag once when the row's view is created: the flag comes from `AddedRows.added`, computed in the list's body from the identities of the previous render of the same sidebar item (a pending row and the task it becomes share the idempotency key), so cell reuse on scroll never replays it and switching items or loading springs nothing. The sidebar title flight does not use `matchedGeometryEffect`: a non-source view copies its source's frame for good, which is what blanked the selected row; instead each sidebar row records its origin and the header title starts at that origin and settles, with a crossfade under Reduce Motion and no flight when no row was measured.

Known gap: the title does not fly on the first selection after launch, until the header's origin has been measured once.

Evidence: the unit tests of `CountRoll`, `CountRollCoordinator`, `AddedRows` and `TitleFlight`; offscreen hosting windows do not advance SwiftUI animations, so the README GIF crossfades between real renders of the window instead of sampling the springs.
