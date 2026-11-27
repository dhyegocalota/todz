public enum RowArrival {
    // NB ADR 0114: rows cascade only when a different list or a finished load replaces what was shown, never on scroll or on one added row.
    public static func indices(known: ShownRows?, current: ShownRows, ordered: [RowIdentity]) -> [RowIdentity: Int] {
        guard let identities = current.identities else { return [:] }
        let isSameLoadedList = known?.item == current.item && known?.identities != nil
        guard !isSameLoadedList else { return [:] }
        let arriving = ordered.filter(identities.contains).prefix(MotionStagger.staggeredRows)
        return Dictionary(arriving.enumerated().map { ($1, $0) }, uniquingKeysWith: { first, _ in first })
    }
}
