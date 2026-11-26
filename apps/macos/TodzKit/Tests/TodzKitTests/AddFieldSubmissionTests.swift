import Testing
@testable import TodzKit

@Suite struct AddFieldSubmissionTests {
    @Test(arguments: ["", "   ", "\n\t"])
    func aBlankFieldIsIgnored(title: String) {
        #expect(AddFieldSubmission.of(title: title) == .ignored)
    }

    @Test func aTypedTitleIsAcceptedAsTyped() {
        #expect(AddFieldSubmission.of(title: "Acme one") == .accepted(title: "Acme one"))
    }

    @Test func aTitleOverTheLimitIsRefusedWithItsIssue() {
        let title = String(repeating: "a", count: TaskLimits.titleMaxLength + 1)
        #expect(AddFieldSubmission.of(title: title) == .refused(.titleTooLong))
    }
}
