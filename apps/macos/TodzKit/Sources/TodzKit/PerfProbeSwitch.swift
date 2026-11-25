private let probeArgument = "-TodzPerfProbe"
private let scrollArgument = "-TodzPerfScroll"
private let onValue = "YES"

public enum PerfProbeSwitch {
    public static func isOn(arguments: [String]) -> Bool {
        isSet(argument: probeArgument, in: arguments)
    }

    public static func isScrollOn(arguments: [String]) -> Bool {
        isOn(arguments: arguments) && isSet(argument: scrollArgument, in: arguments)
    }

    private static func isSet(argument: String, in arguments: [String]) -> Bool {
        zip(arguments, arguments.dropFirst()).contains { $0 == argument && $1 == onValue }
    }
}
