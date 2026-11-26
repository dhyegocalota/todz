public struct GlobalChordPlan: Equatable, Sendable {
    public let registrations: [WorkspaceAction: KeyChord]
    public let heldBySystem: Set<WorkspaceAction>

    public init(chords: GlobalWorkspaceChords, isHeldBySystem: (KeyChord) -> Bool) {
        let assigned: [(action: WorkspaceAction, chord: KeyChord)] = WorkspaceAction.all.compactMap { action in
            guard let chord = chords.chord(for: action) else { return nil }
            return (action, chord)
        }
        let held = assigned.filter { isHeldBySystem($0.chord) }
        let free = assigned.filter { !isHeldBySystem($0.chord) }
        heldBySystem = Set(held.map(\.action))
        registrations = Dictionary(uniqueKeysWithValues: free.map { ($0.action, $0.chord) })
    }
}
