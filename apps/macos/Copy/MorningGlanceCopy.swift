enum MorningGlanceCopy {
    static let overdue = "Overdue"
    static let openToday = "Open Today in todz"

    static func more(count: Int) -> String {
        "+\(count) more"
    }
}
