import Testing
@testable import TodzKit

@Suite struct AppBannerTests {
    @Test func theAlreadySignedInLineIsCalm() {
        #expect(AppBanner.alreadySignedIn.isCalm)
    }

    @Test(arguments: [AppBanner.network, .server, .changeNotSaved, .signOutFailed, .updateNeeded, .changesRefused(count: 2), .fairUseRefused(message: "Full"), .fairUsePaused(message: "Tomorrow"), .changesFairUseRefused(message: "Full", count: 2)])
    func everyOtherBannerIsAnError(banner: AppBanner) {
        #expect(banner.isCalm == false)
    }
}
