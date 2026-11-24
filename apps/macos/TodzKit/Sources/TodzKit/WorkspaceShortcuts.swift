public enum WorkspaceShortcuts {
    public static let numbers = 1...9

    public static func workspace(number: Int, in workspaces: [Workspace]) -> Workspace? {
        let position = number - numbers.lowerBound
        guard numbers.contains(number), workspaces.indices.contains(position) else { return nil }
        return workspaces[position]
    }

    public static func numbered(_ workspaces: [Workspace]) -> [(number: Int, workspace: Workspace)] {
        zip(numbers, workspaces).map { (number: $0, workspace: $1) }
    }

    public static func number(forKey key: String) -> Int? {
        fatalError("number(forKey:) is not implemented")
    }

    public static func lastNumber(of workspaces: [Workspace]) -> Int {
        min(workspaces.count, numbers.upperBound)
    }
}
