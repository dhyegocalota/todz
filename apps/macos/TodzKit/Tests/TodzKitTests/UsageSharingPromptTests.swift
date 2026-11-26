import Testing
@testable import TodzKit

@Suite struct UsageSharingPromptTests {
    @Test func notNowIsTheDefaultAnswerSoReturnDeclines() {
        #expect(UsageSharingPrompt.defaultAnswer == .declineNow)
        #expect(UsageSharingPrompt.buttonsInOrder.first == UsageSharingPrompt.defaultAnswer)
    }

    @Test func escapeDeclines() {
        #expect(UsageSharingPrompt.escapeAnswer == .declineNow)
    }

    @Test func aButtonIndexAnswersWithItsButton() {
        #expect(UsageSharingPrompt.answer(forButtonIndex: 0) == .declineNow)
        #expect(UsageSharingPrompt.answer(forButtonIndex: 1) == .share)
    }

    @Test func shareIsOfferedOnlyAsASecondButton() {
        #expect(UsageSharingPrompt.buttonsInOrder == [.declineNow, .share])
    }
}
