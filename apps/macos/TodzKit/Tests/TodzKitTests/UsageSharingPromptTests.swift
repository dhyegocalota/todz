import Testing
@testable import TodzKit

@Suite struct UsageSharingPromptTests {
    @Test func notNowIsTheDefaultAnswerSoReturnDeclines() {
        #expect(UsageSharingPrompt.defaultAnswer == .declineNow)
        #expect(UsageSharingPrompt.buttonsInOrder.first == UsageSharingPrompt.defaultAnswer)
    }

    @Test func escapeDeclinesThroughTheFirstButton() {
        #expect(UsageSharingPrompt.escapeAnswer == .declineNow)
        #expect(UsageSharingPrompt.buttonsInOrder.first == UsageSharingPrompt.escapeAnswer)
    }

    @Test func escapeKeyIsKeyCodeFiftyThree() {
        #expect(UsageSharingPrompt.isEscape(keyCode: 53))
        #expect(!UsageSharingPrompt.isEscape(keyCode: 36))
    }

    @Test func aButtonIndexAnswersWithItsButton() {
        #expect(UsageSharingPrompt.answer(forButtonIndex: 0) == .declineNow)
        #expect(UsageSharingPrompt.answer(forButtonIndex: 1) == .share)
    }

    @Test func aButtonIndexOutsideTheButtonsAnswersNothing() {
        #expect(UsageSharingPrompt.answer(forButtonIndex: 2) == nil)
        #expect(UsageSharingPrompt.answer(forButtonIndex: -1) == nil)
    }

    @Test func shareIsOfferedOnlyAsASecondButton() {
        #expect(UsageSharingPrompt.buttonsInOrder == [.declineNow, .share])
    }
}
