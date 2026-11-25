@testable import TodzKit

final class InMemorySessionVault: SessionVault {
    var secret: String?
    var origin: String? = harnessDefaultServer
    var isUnreadable = false
    var isUnwritable = false
    var isUnerasable = false
    var eraseCount = 0
    var onErase: (() -> Void)?

    func read() throws -> StoredSession? {
        guard !isUnreadable else { throw SessionVaultError.unreadable }
        guard let secret else { return nil }
        guard let origin else { throw SessionVaultError.unbound }
        return StoredSession(secret: secret, origin: origin)
    }

    func write(_ session: StoredSession) throws {
        guard !isUnwritable else { throw SessionVaultError.unwritable }
        secret = session.secret
        origin = session.origin
    }

    func bind(to origin: String) throws {
        guard !isUnwritable else { throw SessionVaultError.unwritable }
        self.origin = origin
    }

    func erase() throws {
        eraseCount += 1
        guard !isUnerasable else { throw SessionVaultError.unwritable }
        secret = nil
        onErase?()
    }
}
