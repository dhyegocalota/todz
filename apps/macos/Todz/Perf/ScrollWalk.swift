import AppKit
import QuartzCore
import SwiftUI
import TodzKit

private let walkStepCount = 200
private let walkStepInterval: Duration = .milliseconds(50)

@MainActor private final class FrameRecorder: NSObject {
    private var counter: HitchCounter
    private var link: CADisplayLink?

    init?(view: NSView) {
        guard let screen = view.window?.screen else { return nil }
        counter = HitchCounter(refreshRate: Double(screen.maximumFramesPerSecond))
        super.init()
        link = view.displayLink(target: self, selector: #selector(record(_:)))
        link?.add(to: .main, forMode: .common)
    }

    @objc private func record(_ link: CADisplayLink) {
        counter.record(timestamp: link.timestamp)
    }

    func finish() -> HitchReport {
        link?.invalidate()
        link = nil
        return counter.report
    }
}

@MainActor enum ScrollWalk {
    private static var hasRun = false

    static func run(sections: [TaskSection], proxy: ScrollViewProxy) async {
        let isWalkOn = PerfProbeSwitch.isScrollOn(arguments: ProcessInfo.processInfo.arguments)
        guard isWalkOn, !hasRun, let probe = PerfProbe.shared else { return }
        let keys = sections.flatMap(\.tasks).map(\.key)
        guard !keys.isEmpty, let view = NSApp.keyWindow?.contentView, let recorder = FrameRecorder(view: view) else { return }
        hasRun = true
        let keysPerStep = max(keys.count / walkStepCount, 1)
        let walkedKeys = keys.enumerated().filter { $0.offset % keysPerStep == 0 }.map(\.element)
        for key in walkedKeys {
            proxy.scrollTo(key, anchor: .top)
            try? await Task.sleep(for: walkStepInterval)
        }
        let report = recorder.finish()
        probe.log(.scroll(frames: report.frames, overBudget: report.overBudget, worstMilliseconds: report.worstMilliseconds, refreshMilliseconds: report.refreshMilliseconds))
    }
}
