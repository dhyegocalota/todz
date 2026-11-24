import Testing
@testable import TodzKit

@Suite struct HistoryFailureTests {
    @Test func aFailureWhileOfflineIsOffline() {
        #expect(HistoryFailure.of(isOffline: true) == .offline)
    }

    @Test func aFailureWhileOnlineIsFailed() {
        #expect(HistoryFailure.of(isOffline: false) == .failed)
    }
}
