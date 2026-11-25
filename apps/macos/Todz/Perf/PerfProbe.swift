import Darwin
import Foundation
import OSLog
import TodzKit

private let logCategory = "perf"
private let footprintInterval: Duration = .seconds(30)
private let bytesPerMegabyte: UInt64 = 1_048_576
private let microsecondsPerSecond = 1_000_000.0

@MainActor final class PerfProbe {
    static let shared: PerfProbe? = PerfProbeSwitch.isOn(arguments: ProcessInfo.processInfo.arguments) ? PerfProbe() : nil

    private let logger = Logger(subsystem: AppConfiguration.defaultsDomain, category: logCategory)
    private var isLaunchReadyLogged = false
    private var footprintLoop: Task<Void, Never>?

    func start(model: AppModel) {
        model.onTaskArrived = { [weak self] number in
            self?.log(.taskArrived(number: number, at: Date()))
        }
        footprintLoop = Task { [weak self] in
            while !Task.isCancelled {
                self?.logFootprint()
                try? await Task.sleep(for: footprintInterval)
            }
        }
    }

    func rowsAppeared() {
        guard !isLaunchReadyLogged, let processStart = Self.processStart else { return }
        isLaunchReadyLogged = true
        let milliseconds = LaunchInterval.milliseconds(processStart: processStart, firstRows: Date().timeIntervalSince1970)
        log(.launchReady(milliseconds: milliseconds))
    }

    func log(_ line: PerfProbeLine) {
        logger.info("\(line.text, privacy: .public)")
    }

    private func logFootprint() {
        guard let footprint = Self.footprintBytes else { return }
        log(.footprint(megabytes: Int(footprint / bytesPerMegabyte)))
    }

    private static var processStart: TimeInterval? {
        var information = kinfo_proc()
        var size = MemoryLayout<kinfo_proc>.stride
        var identifiers: [Int32] = [CTL_KERN, KERN_PROC, KERN_PROC_PID, getpid()]
        guard sysctl(&identifiers, UInt32(identifiers.count), &information, &size, nil, 0) == 0 else { return nil }
        let started = information.kp_proc.p_un.__p_starttime
        return TimeInterval(started.tv_sec) + TimeInterval(started.tv_usec) / microsecondsPerSecond
    }

    private static var footprintBytes: UInt64? {
        var information = task_vm_info_data_t()
        var count = mach_msg_type_number_t(MemoryLayout<task_vm_info_data_t>.size / MemoryLayout<integer_t>.size)
        let status = withUnsafeMutablePointer(to: &information) { pointer in
            pointer.withMemoryRebound(to: integer_t.self, capacity: Int(count)) {
                task_info(mach_task_self_, task_flavor_t(TASK_VM_INFO), $0, &count)
            }
        }
        guard status == KERN_SUCCESS else { return nil }
        return information.phys_footprint
    }
}
