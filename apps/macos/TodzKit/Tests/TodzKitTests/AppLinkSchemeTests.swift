import Testing
@testable import TodzKit

private let linkSchemeKey = "TodzLinkScheme"

@Suite struct AppLinkSchemeTests {
    @Test(arguments: [("todz-dev", AppLinkScheme.debug), ("todz", .release)])
    func theKeyNamesTheScheme(text: String, expected: AppLinkScheme) {
        #expect(AppLinkScheme.of(info: [linkSchemeKey: text]) == expected)
    }

    @Test func aBundleWithoutTheKeyHasNoScheme() {
        #expect(AppLinkScheme.of(info: [:]) == nil)
    }

    @Test(arguments: ["", "https", "TODZ"])
    func aKeyThatNamesNoSchemeOfOursHasNoScheme(text: String) {
        #expect(AppLinkScheme.of(info: [linkSchemeKey: text]) == nil)
    }

    @Test func aKeyThatIsNotTextHasNoScheme() {
        #expect(AppLinkScheme.of(info: [linkSchemeKey: 1]) == nil)
    }
}
