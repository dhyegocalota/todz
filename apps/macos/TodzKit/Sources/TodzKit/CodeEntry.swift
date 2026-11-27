public struct CodeEntry: Equatable, Sendable {
    public static let length = 6

    public private(set) var digits: [Character] = []

    public init() {}

    public var text: String {
        String(digits)
    }

    public var isComplete: Bool {
        digits.count == Self.length
    }

    public var focusedIndex: Int {
        min(digits.count, Self.length - 1)
    }

    public func digit(at index: Int) -> Character? {
        digits.indices.contains(index) ? digits[index] : nil
    }

    @discardableResult
    public mutating func edit(to text: String) -> String? {
        digits = Array(text.filter { $0.isASCII && $0.isWholeNumber }.prefix(Self.length))
        return isComplete ? self.text : nil
    }
}
