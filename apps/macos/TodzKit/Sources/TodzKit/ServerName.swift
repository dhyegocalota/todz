public enum ServerName {
    public static func of(address: ServerAddress) -> String {
        address.authority
    }
}
