struct DottedVersion: Comparable {
    private let parts: [UInt]

    init?(text: String) {
        let pieces = text.split(separator: ".", omittingEmptySubsequences: false)
        let numbers = pieces.filter { $0.allSatisfy(\.isWholeNumber) }.compactMap { UInt($0) }
        guard numbers.count == pieces.count else { return nil }
        parts = numbers
    }

    static func == (left: DottedVersion, right: DottedVersion) -> Bool {
        let length = max(left.parts.count, right.parts.count)
        return left.padded(to: length) == right.padded(to: length)
    }

    static func < (left: DottedVersion, right: DottedVersion) -> Bool {
        let length = max(left.parts.count, right.parts.count)
        return left.padded(to: length).lexicographicallyPrecedes(right.padded(to: length))
    }

    private func padded(to length: Int) -> [UInt] {
        parts + Array(repeating: 0, count: length - parts.count)
    }
}
