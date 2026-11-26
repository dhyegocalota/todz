public struct GlobalChordPlan: Equatable, Sendable {
    public let registrations: [WorkspaceAction: KeyChord]

    public init(chords: GlobalWorkspaceChords) {
        registrations = Dictionary(uniqueKeysWithValues: WorkspaceAction.all.compactMap { action in
            guard let chord = chords.chord(for: action) else { return nil }
            guard !WorkspaceAction.inAppChords.contains(chord) else { return nil }
            return (action, chord)
        })
    }
}
