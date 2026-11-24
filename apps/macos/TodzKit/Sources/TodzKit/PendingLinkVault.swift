public protocol PendingLinkVault {
    func read() throws -> PendingSignInLink?
    func write(_ link: PendingSignInLink) throws
    func erase() throws
}
