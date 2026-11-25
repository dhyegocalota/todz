import Testing
@testable import TodzKit

@Suite struct ChallengeHeightTests {
    @Test(arguments: [0.0, -10.0, 64.9, Double.nan, -Double.infinity])
    func aHeightBelowTheWidgetOrNotANumberClampsToTheManagedWidgetHeight(reported: Double) {
        #expect(ChallengeHeight.clamped(reported: reported) == 65)
    }

    @Test(arguments: [65.0, 120.0, 499.5, 500.0])
    func aHeightInRangePassesThrough(reported: Double) {
        #expect(ChallengeHeight.clamped(reported: reported) == reported)
    }

    @Test(arguments: [500.1, 9999.0, Double.infinity])
    func aHeightAboveTheMaximumClampsToTheMaximum(reported: Double) {
        #expect(ChallengeHeight.clamped(reported: reported) == 500)
    }

    @Test func theScriptReportsTheWidgetHeightToTheHeightHandler() {
        let script = ChallengeHeight.observerScript
        #expect(script.contains("window.webkit.messageHandlers.\(ChallengeHeight.handlerName).postMessage"))
        #expect(script.contains(".cf-turnstile"))
        #expect(script.contains("ResizeObserver"))
    }
}
