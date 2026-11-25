public protocol SessionVault {
    func read() throws -> StoredSession?
    func write(_ session: StoredSession) throws
    func erase() throws
}
