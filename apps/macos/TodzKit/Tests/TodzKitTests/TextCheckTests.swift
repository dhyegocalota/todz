import Testing
@testable import TodzKit

private let thumbsUpWithSkinTone = "👍🏽"

private func letters(_ count: Int) -> String {
    String(repeating: "a", count: count)
}

@Suite struct TextCheckTests {
    @Test(arguments: ["", "   ", "\n\t "])
    func aBlankTitleIsEmpty(title: String) {
        #expect(TextCheck.issue(ofTitle: title) == .titleEmpty)
    }

    @Test func aTitleAtTheLimitPasses() {
        #expect(TextCheck.issue(ofTitle: letters(TaskLimits.titleMaxLength)) == nil)
        #expect(TextCheck.issue(ofTitle: "  " + letters(TaskLimits.titleMaxLength) + "  ") == nil)
    }

    @Test func aTitleOverTheLimitIsTooLong() {
        #expect(TextCheck.issue(ofTitle: letters(TaskLimits.titleMaxLength + 1)) == .titleTooLong)
    }

    @Test func aTitleCollapsesInnerSpacesBeforeItIsCounted() {
        let halves = letters(TaskLimits.titleMaxLength / 2)
        #expect(TextCheck.issue(ofTitle: halves + "      " + halves.dropLast()) == nil)
    }

    @Test func aTitleCountsCodePointsAsTheServerDoes() {
        let pairs = String(repeating: thumbsUpWithSkinTone, count: TaskLimits.titleMaxLength / 2 + 1)
        #expect(TextCheck.issue(ofTitle: pairs) == .titleTooLong)
    }

    @Test func aNameIsCheckedAgainstTheNameLimit() {
        #expect(TextCheck.issue(ofName: " ") == .nameEmpty)
        #expect(TextCheck.issue(ofName: letters(TaskLimits.nameMaxLength)) == nil)
        #expect(TextCheck.issue(ofName: letters(TaskLimits.nameMaxLength + 1)) == .nameTooLong)
    }

    @Test func notesAreCheckedAgainstTheNotesLimit() {
        #expect(TextCheck.issue(ofNotes: "") == nil)
        #expect(TextCheck.issue(ofNotes: letters(TaskLimits.notesMaxLength)) == nil)
        #expect(TextCheck.issue(ofNotes: letters(TaskLimits.notesMaxLength + 1)) == .notesTooLong)
    }

    @Test func notesCountAWindowsLineBreakAsOne() {
        #expect(TextCheck.issue(ofNotes: String(repeating: "\r\n", count: TaskLimits.notesMaxLength)) == nil)
    }
}
