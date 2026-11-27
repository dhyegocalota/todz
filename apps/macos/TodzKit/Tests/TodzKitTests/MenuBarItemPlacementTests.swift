import CoreGraphics
import Testing
@testable import TodzKit

private let wideScreen = CGRect(x: 0, y: 0, width: 3440, height: 1440)
private let leftScreen = CGRect(x: -1920, y: 0, width: 1920, height: 1080)
private let parkedItem = CGRect(x: -1, y: -23, width: 44, height: 24)
private let shownItem = CGRect(x: 3119, y: 1413, width: 47, height: 24)
private let leftScreenItem = CGRect(x: -200, y: 1053, width: 44, height: 24)
private let midScreenItem = CGRect(x: 1200, y: 700, width: 44, height: 24)

@Suite struct MenuBarItemPlacementTests {
    @Test func theFrameMacOSParksABlockedItemAtIsOffTheBar() {
        #expect(!MenuBarItemPlacement.isOnTheBar(itemFrame: parkedItem, screenFrames: [wideScreen]))
    }

    @Test func aFrameInTheTopBandOfTheScreenIsOnTheBar() {
        #expect(MenuBarItemPlacement.isOnTheBar(itemFrame: shownItem, screenFrames: [wideScreen]))
    }

    @Test func aFrameInTheTopBandOfASecondScreenIsOnTheBar() {
        #expect(MenuBarItemPlacement.isOnTheBar(itemFrame: leftScreenItem, screenFrames: [wideScreen, leftScreen]))
    }

    @Test func aFrameInTheMiddleOfAScreenIsOffTheBar() {
        #expect(!MenuBarItemPlacement.isOnTheBar(itemFrame: midScreenItem, screenFrames: [wideScreen]))
    }

    @Test func noScreenMeansOffTheBar() {
        #expect(!MenuBarItemPlacement.isOnTheBar(itemFrame: shownItem, screenFrames: []))
    }
}
