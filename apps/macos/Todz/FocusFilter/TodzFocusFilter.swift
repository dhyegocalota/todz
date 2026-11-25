import AppIntents
import TodzKit

struct TodzFocusFilter: SetFocusFilterIntent {
    static let title: LocalizedStringResource = "Quiet todz"
    static let description: IntentDescription? = "Keeps todz from showing anything on its own while this Focus is on."

    @Parameter(title: "Keep todz quiet", default: false) var isQuiet: Bool

    @Dependency private var gate: ProactiveGate

    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(title: "\(FocusCopy.filterTitle)", subtitle: "\(FocusCopy.filterSubtitle(isQuiet: isQuiet))")
    }

    func perform() async throws -> some IntentResult {
        await gate.setQuiet(isQuiet)
        return .result()
    }
}
