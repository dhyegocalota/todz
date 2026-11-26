public enum NameConfirmation {
    public static func isConfirmed(typed: String, name: String) -> Bool {
        !name.isEmpty && typed == name
    }
}
