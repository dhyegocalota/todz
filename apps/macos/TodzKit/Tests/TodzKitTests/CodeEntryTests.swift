import Foundation
import Testing
@testable import TodzKit

@Suite struct CodeEntryTests {
    @Test func aFreshEntryIsEmptyAndFocusesTheFirstBox() {
        let entry = CodeEntry()
        #expect(entry.text == "")
        #expect(!entry.isComplete)
        #expect(entry.focusedIndex == 0)
    }

    @Test func typingAdvancesOneBoxPerDigitAndCompletesOnTheSixth() {
        var entry = CodeEntry()
        let results = ["1", "12", "123", "1234", "12345", "123456"].map { entry.edit(to: $0) }
        #expect(results == [nil, nil, nil, nil, nil, "123456"])
        #expect(entry.isComplete)
        #expect(entry.focusedIndex == 5)
    }

    @Test func theFocusFollowsTheNextEmptyBox() {
        var entry = CodeEntry()
        entry.edit(to: "12")
        #expect(entry.focusedIndex == 2)
        #expect(entry.digit(at: 1) == "2")
        #expect(entry.digit(at: 2) == nil)
    }

    @Test func lettersSpacesAndOtherScriptsAreIgnored() {
        var entry = CodeEntry()
        entry.edit(to: "a ٣")
        #expect(entry.text == "")
        entry.edit(to: "1a2")
        #expect(entry.text == "12")
    }

    @Test func typingAfterTheSixthDigitChangesNothing() {
        var entry = CodeEntry()
        entry.edit(to: "123456")
        #expect(entry.edit(to: "1234567") == "123456")
        #expect(entry.text == "123456")
    }

    @Test func backspaceRemovesTheLastDigitAndNeverGoesBelowEmpty() {
        var entry = CodeEntry()
        entry.edit(to: "12")
        entry.edit(to: "1")
        #expect(entry.text == "1")
        entry.edit(to: "")
        entry.edit(to: "")
        #expect(entry.text == "")
        #expect(entry.focusedIndex == 0)
    }

    @Test func backspaceOnACompleteEntryReopensTheLastBox() {
        var entry = CodeEntry()
        entry.edit(to: "123456")
        entry.edit(to: "12345")
        #expect(!entry.isComplete)
        #expect(entry.focusedIndex == 5)
        #expect(entry.edit(to: "123459") == "123459")
    }

    @Test func pastingASixDigitCodeFillsEveryBoxAndSubmits() {
        var entry = CodeEntry()
        #expect(entry.edit(to: "482 915") == "482915")
        #expect(entry.isComplete)
    }

    @Test func pastingTextAroundTheCodeKeepsOnlyItsDigits() {
        var entry = CodeEntry()
        #expect(entry.edit(to: "Your todz code is 482915.") == "482915")
    }

    @Test func pastingMoreThanSixDigitsKeepsTheFirstSix() {
        var entry = CodeEntry()
        #expect(entry.edit(to: "12345678") == "123456")
    }

    @Test func pastingOverTypedDigitsReplacesThem() {
        var entry = CodeEntry()
        entry.edit(to: "9")
        #expect(entry.edit(to: "482915") == "482915")
    }

    @Test func aShortPasteFillsFromTheStartAndWaitsForTheRest() {
        var entry = CodeEntry()
        #expect(entry.edit(to: "48 29") == nil)
        #expect(entry.text == "4829")
        #expect(entry.focusedIndex == 4)
    }

    @Test func resendWaitsThirtySecondsAndCountsDownRoundedUp() {
        let sentAt = fixedInstant
        #expect(CodeResend.remainingSeconds(sentAt: sentAt, now: sentAt) == 30)
        #expect(CodeResend.remainingSeconds(sentAt: sentAt, now: sentAt.addingTimeInterval(0.4)) == 30)
        #expect(CodeResend.remainingSeconds(sentAt: sentAt, now: sentAt.addingTimeInterval(29.2)) == 1)
        #expect(CodeResend.remainingSeconds(sentAt: sentAt, now: sentAt.addingTimeInterval(30)) == nil)
    }
}
