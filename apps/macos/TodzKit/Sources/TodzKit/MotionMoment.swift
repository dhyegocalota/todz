public enum MotionMoment: CaseIterable, Sendable {
    case listInsert
    case listRemove
    case complete
    case uncomplete
    case reorder
    case workspaceSwitch
    case popoverOpen
    case sheetPresent
    case busySwap
    case stageChange
    case disclosure
    case countChange
    case ringFill
    case upNextSwap
    case banner
    case skeletonToRows
    case press
    case hover
    case focus
}
