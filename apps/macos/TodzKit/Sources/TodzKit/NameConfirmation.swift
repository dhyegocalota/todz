import Foundation

public enum NameConfirmation {
    public static func isConfirmed(typed: String, name: String) -> Bool {
        !name.isEmpty && typed.trimmingCharacters(in: .whitespacesAndNewlines) == name
    }
}
