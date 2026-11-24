public enum WorkspaceShortcuts {
    public static let count = 9

    public static func workspace(number: Int, in workspaces: [Workspace]) -> Workspace? {
        let position = number - 1
        let isShortcutNumber = (1...count).contains(number)
        guard isShortcutNumber, workspaces.indices.contains(position) else { return nil }
        return workspaces[position]
    }

    public static func numbered(_ workspaces: [Workspace]) -> [(number: Int, workspace: Workspace)] {
        fatalError("numbered(_:) is not implemented")
    }

    public static func lastNumber(of workspaces: [Workspace]) -> Int {
        fatalError("lastNumber(of:) is not implemented")
    }
}
