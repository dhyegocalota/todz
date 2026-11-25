import Testing
@testable import TodzKit

@Suite struct FocusQuietNoticeTests {
    @Test func notQuietReadsAsNotQuiet() {
        #expect(FocusQuietNotice(isQuiet: false) == .notQuiet)
    }

    @Test func quietReadsAsQuietNow() {
        #expect(FocusQuietNotice(isQuiet: true) == .quietNow)
    }
}
