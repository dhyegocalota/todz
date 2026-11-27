import CoreGraphics
import Testing
@testable import TodzKit

private let screen = CGRect(x: 0, y: 0, width: 3440, height: 1440)
private let parkedItem = CGRect(x: -1, y: -23, width: 44, height: 24)
private let shownItem = CGRect(x: 3119, y: 1413, width: 47, height: 24)

@MainActor private final class CheckRig {
    let gate = ProactiveGate(respectsFocus: true)
    let pause = HeldPause()
    var isDeclined = false
    var itemFrame: CGRect? = parkedItem
    var screenFrames = [screen]
    private(set) var offerCount = 0
    private(set) lazy var check = HiddenMenuBarItemCheck(
        gate: gate,
        isDeclined: { [unowned self] in isDeclined },
        pause: { [pause] in try await pause.pause($0) },
        itemFrame: { [unowned self] in itemFrame },
        screenFrames: { [unowned self] in screenFrames },
        offer: { [unowned self] in offerCount += 1 }
    )

    func settled() async {
        let running = Task { await check.run() }
        await pause.started(count: pause.durations.count + 1)
        pause.release()
        await running.value
    }
}

@MainActor @Suite struct HiddenMenuBarItemCheckTests {
    @Test func aParkedItemIsOfferedOnceAfterTheItemSettles() async {
        let rig = CheckRig()
        await rig.settled()
        #expect(rig.pause.durations == [HiddenMenuBarItemCheck.settlingPause])
        #expect(rig.offerCount == 1)
        await rig.check.run()
        #expect(rig.offerCount == 1)
        #expect(rig.pause.durations.count == 1)
    }

    @Test func anItemOnTheBarIsNeverOffered() async {
        let rig = CheckRig()
        rig.itemFrame = shownItem
        await rig.settled()
        #expect(rig.offerCount == 0)
    }

    @Test func aDeclinedNoticeNeverWaitsOrOffers() async {
        let rig = CheckRig()
        rig.isDeclined = true
        await rig.check.run()
        #expect(rig.pause.durations.isEmpty)
        #expect(rig.offerCount == 0)
    }

    @Test func aQuietGateHoldsTheNoticeBeforeAndAfterThePause() async {
        let rig = CheckRig()
        rig.gate.setQuiet(true)
        await rig.check.run()
        #expect(rig.pause.durations.isEmpty)
        rig.gate.setQuiet(false)
        let running = Task { await rig.check.run() }
        await rig.pause.started()
        rig.gate.setQuiet(true)
        rig.pause.release()
        await running.value
        #expect(rig.offerCount == 0)
    }

    @Test func noScreenOrNoItemMeansNoNotice() async {
        let rig = CheckRig()
        rig.screenFrames = []
        await rig.settled()
        rig.screenFrames = [screen]
        rig.itemFrame = nil
        await rig.settled()
        #expect(rig.offerCount == 0)
    }

    @Test func aSecondCheckWhileTheFirstWaitsDoesNothing() async {
        let rig = CheckRig()
        let first = Task { await rig.check.run() }
        await rig.pause.started()
        await rig.check.run()
        rig.pause.release()
        await first.value
        #expect(rig.pause.durations.count == 1)
        #expect(rig.offerCount == 1)
    }

    @Test func aCancelledPauseOffersNothing() async {
        let rig = CheckRig()
        let running = Task { await rig.check.run() }
        await rig.pause.started()
        running.cancel()
        await running.value
        #expect(rig.offerCount == 0)
    }
}
