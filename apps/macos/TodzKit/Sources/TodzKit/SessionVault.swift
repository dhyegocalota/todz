public protocol SessionVault {
    func read() throws -> StoredSession?
    func write(_ session: StoredSession) throws
    func bind(to origin: String) throws
    func erase() throws
}
