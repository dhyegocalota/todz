enum WorkspacePickerCopy {
    static let title = "Choose a workspace"
    static let body = "Pick the workspace to open on this Mac. You can switch later from the Workspace menu."

    static func projectCount(count: Int) -> String {
        InflectedCopy.text("\(count) projects")
    }
}
