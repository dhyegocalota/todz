@testable import TodzKit

final class InMemoryPendingLinkVault: PendingLinkVault {
    var link: PendingSignInLink?
    var isUnwritable = false
    var isUnerasable = false
    var eraseCount = 0
    var onErase: (() -> Void)?

    func read() throws -> PendingSignInLink? {
        link
    }

    func write(_ link: PendingSignInLink) throws {
        guard !isUnwritable else { throw PendingLinkVaultError.unwritable }
        self.link = link
    }

    func erase() throws {
        eraseCount += 1
        guard !isUnerasable else { throw PendingLinkVaultError.unwritable }
        link = nil
        onErase?()
    }
}
