public enum WorkspaceShortcuts {
    public static let numbers = 1...9
    public static let listModifiers: ChordModifiers = [.command]
    public static let globalModifiers: ChordModifiers = [.control, .option, .command]

    public static func workspace(number: Int, in workspaces: [Workspace]) -> Workspace? {
        let position = number - numbers.lowerBound
        guard numbers.contains(number), workspaces.indices.contains(position) else { return nil }
        return workspaces[position]
    }

    public static func workspace(action: WorkspaceAction, activeIdentifier: String?, in workspaces: [Workspace]) -> Workspace? {
        switch action {
        case let .number(number): return Self.workspace(number: number, in: workspaces)
        case .previous: return neighbour(step: -1, from: activeIdentifier, in: workspaces)
        case .next: return neighbour(step: 1, from: activeIdentifier, in: workspaces)
        }
    }

    private static func neighbour(step: Int, from activeIdentifier: String?, in workspaces: [Workspace]) -> Workspace? {
        guard !workspaces.isEmpty else { return nil }
        let activePosition = workspaces.firstIndex { $0.identifier == activeIdentifier }
        guard let activePosition else { return step > 0 ? workspaces.first : workspaces.last }
        return workspaces[(activePosition + step + workspaces.count) % workspaces.count]
    }

    public static func shouldRegister(phase: AppPhase, workspaceCount: Int, isGlobalOn: Bool) -> Bool {
        phase == .ready && workspaceCount > 0 && isGlobalOn
    }

    public static func numbered(_ workspaces: [Workspace]) -> [(number: Int, workspace: Workspace)] {
        zip(numbers, workspaces).map { (number: $0, workspace: $1) }
    }

    public static func numbered(_ presented: [PresentedWorkspace]) -> [(number: Int, presented: PresentedWorkspace)] {
        zip(numbers, presented).map { (number: $0, presented: $1) }
    }

    public static func number(forKey key: String) -> Int? {
        guard let number = Int(key), numbers.contains(number) else { return nil }
        return number
    }

    public static func lastNumber(of workspaces: [Workspace]) -> Int {
        min(workspaces.count, numbers.upperBound)
    }
}
