enum FocusCopy {
    static let filterTitle = "todz"
    static let filterQuiet = "Stays quiet"
    static let filterNotQuiet = "Shows as usual"

    static func filterSubtitle(isQuiet: Bool) -> String {
        isQuiet ? filterQuiet : filterNotQuiet
    }
}
