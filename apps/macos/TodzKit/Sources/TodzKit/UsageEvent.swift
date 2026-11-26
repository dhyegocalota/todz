public enum UsageEvent: String, CaseIterable, Codable, Sendable {
    case popoverOpened = "popover_opened"
    case dayClosed = "day_closed"
    case morningGlance = "morning_glance"
    case shortcutUsed = "shortcut_used"
    case multiWorkspace = "multi_workspace"
}
