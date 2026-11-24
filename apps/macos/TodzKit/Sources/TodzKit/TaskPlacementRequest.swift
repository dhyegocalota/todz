public enum TaskPlacementRequest {
    public static func placement(openNumbers: [Int], moving number: Int, toOffset offset: Int) -> TaskPlacement? {
        guard let index = openNumbers.firstIndex(of: number) else { return nil }
        guard (0...openNumbers.count).contains(offset) else { return nil }
        let insertionIndex = offset > index ? offset - 1 : offset
        guard insertionIndex != index else { return nil }
        guard insertionIndex > 0 else { return .first }
        let others = openNumbers.filter { $0 != number }
        return .after(anchor: others[insertionIndex - 1])
    }

    public static func placement(openNumbers: [Int], moving number: Int, direction: TaskMoveDirection) -> TaskPlacement? {
        guard let index = openNumbers.firstIndex(of: number) else { return nil }
        return placement(openNumbers: openNumbers, moving: number, toOffset: index + direction.offsetStep)
    }
}
