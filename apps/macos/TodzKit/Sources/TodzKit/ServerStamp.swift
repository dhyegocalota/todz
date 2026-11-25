private let stampSeparator: Character = "+"

public enum ServerStamp {
    public static func date(of stamp: String) -> String {
        String(stamp.prefix { $0 != stampSeparator })
    }
}
