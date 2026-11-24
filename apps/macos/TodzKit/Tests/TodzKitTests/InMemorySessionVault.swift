@testable import TodzKit

final class InMemorySessionVault: SessionVault {
    var secret: String?
    var isUnreadable = false
    var isUnwritable = false
    var eraseCount = 0
    var onErase: (() -> Void)?

    func read() throws -> String? {
        guard !isUnreadable else { throw SessionVaultError.unreadable }
        return secret
    }

    func write(_ secret: String) throws {
        guard !isUnwritable else { throw SessionVaultError.unwritable }
        self.secret = secret
    }

    func erase() throws {
        eraseCount += 1
        secret = nil
        onErase?()
    }
}
