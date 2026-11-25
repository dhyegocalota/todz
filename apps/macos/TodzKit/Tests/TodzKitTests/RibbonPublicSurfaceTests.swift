import Testing
import TodzKit

@Suite struct RibbonPublicSurfaceTests {
    @Test func theCloseTheDaySwitchIsReadableOutsideTheModule() throws {
        let domain = try EmptyDomain()
        let preference = DayClosePreference(defaults: domain.defaults, domainName: domain.name)
        #expect(!preference.isOn)
    }
}
