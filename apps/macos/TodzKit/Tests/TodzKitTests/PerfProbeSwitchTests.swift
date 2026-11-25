import Foundation
import Testing
@testable import TodzKit

@Suite struct PerfProbeSwitchTests {
    @Test func theProbeIsOnWhenTheArgumentsHoldTheSwitchAndYes() {
        #expect(PerfProbeSwitch.isOn(arguments: ["Todz", "-TodzPerfProbe", "YES"]))
    }

    @Test(arguments: [[], ["-TodzPerfProbe"], ["-TodzPerfProbe", "NO"], ["Todz", "YES"], ["-TodzPerfScroll", "YES"]])
    func theProbeIsOffWithoutTheSwitchAndYes(arguments: [String]) {
        #expect(PerfProbeSwitch.isOn(arguments: arguments) == false)
    }

    @Test func aDefaultsValueAloneNeverTurnsTheProbeOn() throws {
        let name = UUID().uuidString
        let defaults = try #require(UserDefaults(suiteName: name))
        defaults.set("YES", forKey: "TodzPerfProbe")
        defer { defaults.removePersistentDomain(forName: name) }
        #expect(PerfProbeSwitch.isOn(arguments: []) == false)
    }

    @Test func theScrollWalkNeedsBothSwitches() {
        #expect(PerfProbeSwitch.isScrollOn(arguments: ["-TodzPerfProbe", "YES", "-TodzPerfScroll", "YES"]))
        #expect(PerfProbeSwitch.isScrollOn(arguments: ["-TodzPerfScroll", "YES"]) == false)
        #expect(PerfProbeSwitch.isScrollOn(arguments: ["-TodzPerfProbe", "YES"]) == false)
    }
}
