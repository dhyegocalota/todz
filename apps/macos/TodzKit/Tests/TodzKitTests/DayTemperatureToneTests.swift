import Testing
@testable import TodzKit

@Suite struct DayTemperatureToneTests {
    @Test func theToneShowsWithTheSettingOnAndTheGateNotQuiet() {
        #expect(DayTemperatureTone.isShown(isSettingOn: true, isQuiet: false))
    }

    @Test func aSwitchedOffSettingShowsNoTone() {
        #expect(!DayTemperatureTone.isShown(isSettingOn: false, isQuiet: false))
    }

    @Test func aQuietGateShowsNoTone() {
        #expect(!DayTemperatureTone.isShown(isSettingOn: true, isQuiet: true))
    }

    @Test func aSwitchedOffSettingUnderAQuietGateShowsNoTone() {
        #expect(!DayTemperatureTone.isShown(isSettingOn: false, isQuiet: true))
    }
}
