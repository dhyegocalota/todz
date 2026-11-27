import Testing
@testable import TodzKit

@Suite struct MenuBarNoticeTests {
    @Test func aBannerOutranksOffline() {
        #expect(MenuBarNotice(hasBanner: true, isOffline: true, hasUpdateNote: false).strip == .banner)
    }

    @Test func offlineOutranksNothing() {
        #expect(MenuBarNotice(hasBanner: false, isOffline: true, hasUpdateNote: false).strip == .offline)
    }

    @Test func nothingShowsNothing() {
        #expect(MenuBarNotice(hasBanner: false, isOffline: false, hasUpdateNote: false).strip == MenuBarNotice.Strip.none)
    }

    @Test func theDotShowsOnlyWithAPendingUpdateNote() {
        #expect(MenuBarNotice(hasBanner: false, isOffline: false, hasUpdateNote: true).showsUpdateDot)
        #expect(!MenuBarNotice(hasBanner: true, isOffline: true, hasUpdateNote: false).showsUpdateDot)
    }
}
