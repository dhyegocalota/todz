struct ByteOrderKey: Comparable {
    private let bytes: [UInt8]

    init(_ text: String) {
        bytes = Array(text.utf8)
    }

    static func < (lhs: ByteOrderKey, rhs: ByteOrderKey) -> Bool {
        lhs.bytes.lexicographicallyPrecedes(rhs.bytes)
    }
}
