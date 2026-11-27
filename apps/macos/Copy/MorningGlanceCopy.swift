enum MorningGlanceCopy {
    static var overdue: String { Localized.text("Overdue") }
    static var openToday: String { Localized.text("Open Today in todz") }

    static func more(count: Int) -> String {
        Localized.text("+\(count) more")
    }
}
