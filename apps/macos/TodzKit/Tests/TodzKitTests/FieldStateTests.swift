import Testing
@testable import TodzKit

struct FieldFacts: Sendable {
    let isFocused: Bool
    let hasIssue: Bool
    let isDisabled: Bool
    let isBusy: Bool

    var state: FieldState {
        FieldState.of(isFocused: isFocused, hasIssue: hasIssue, isDisabled: isDisabled, isBusy: isBusy)
    }
}

private let everyCombination: [FieldFacts] = [false, true].flatMap { isFocused in
    [false, true].flatMap { hasIssue in
        [false, true].flatMap { isDisabled in
            [false, true].map { isBusy in
                FieldFacts(isFocused: isFocused, hasIssue: hasIssue, isDisabled: isDisabled, isBusy: isBusy)
            }
        }
    }
}

private func expectedState(of facts: FieldFacts) -> FieldState {
    if facts.isBusy { return .busy }
    if facts.isDisabled { return .disabled }
    if facts.hasIssue { return .invalid }
    if facts.isFocused { return .focused }
    return .rest
}

@Suite struct FieldStateTests {
    @Test func thereAreSixteenCombinations() {
        #expect(everyCombination.count == 16)
    }

    @Test(arguments: everyCombination)
    func everyCombinationFollowsThePrecedence(facts: FieldFacts) {
        #expect(facts.state == expectedState(of: facts))
    }

    @Test func anIdleUnfocusedFieldWithoutAnIssueIsAtRest() {
        #expect(FieldState.of(isFocused: false, hasIssue: false, isDisabled: false, isBusy: false) == .rest)
    }

    @Test func anInvalidFieldKeepsItsIssueWhileFocused() {
        #expect(FieldState.of(isFocused: true, hasIssue: true, isDisabled: false, isBusy: false) == .invalid)
    }

    @Test func busyOutranksEverything() {
        #expect(FieldState.of(isFocused: true, hasIssue: true, isDisabled: true, isBusy: true) == .busy)
    }

    @Test func disabledOutranksAnIssueAndFocus() {
        #expect(FieldState.of(isFocused: true, hasIssue: true, isDisabled: true, isBusy: false) == .disabled)
    }
}
