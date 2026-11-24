@testable import TodzKit

final class InMemoryPendingLinkVault: PendingLinkVault {
    var link: PendingSignInLink?
    var isUnwritable = false
    var eraseCount = 0

    func read() throws -> PendingSignInLink? {
        link
    }

    func write(_ link: PendingSignInLink) throws {
        guard !isUnwritable else { throw PendingLinkVaultError.unwritable }
        self.link = link
    }

    func erase() throws {
        eraseCount += 1
        link = nil
    }
}
