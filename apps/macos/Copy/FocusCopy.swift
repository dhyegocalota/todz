enum FocusCopy {
    static let filterTitle = "todz"
    static var filterQuiet: String { Localized.text("Stays quiet") }
    static var filterNotQuiet: String { Localized.text("Shows as usual") }

    static func filterSubtitle(isQuiet: Bool) -> String {
        isQuiet ? filterQuiet : filterNotQuiet
    }
}
