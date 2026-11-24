public protocol SessionVault {
    func read() throws -> String?
    func write(_ secret: String) throws
    func erase() throws
}
