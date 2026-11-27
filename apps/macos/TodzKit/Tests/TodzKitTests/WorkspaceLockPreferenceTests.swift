import Foundation
import Testing
@testable import TodzKit

private let isOnKey = "locksOtherWorkspaces"
private let timeoutKey = "workspaceLockIdleMinutes"

@Suite struct WorkspaceLockPreferenceTests {
    @Test func aFreshDomainReadsOffWithFiveMinutes() throws {
        let domain = try EmptyDomain()
        let preference = WorkspaceLockPreference(defaults: domain.defaults, domainName: domain.name)
        #expect(!preference.isOn)
        #expect(preference.timeout == .fiveMinutes)
    }

    @Test func theStorageKeysAreStable() {
        #expect(WorkspaceLockPreference.isOnStorageKey == isOnKey)
        #expect(WorkspaceLockPreference.timeoutStorageKey == timeoutKey)
    }

    @Test func storingRoundTrips() throws {
        let domain = try EmptyDomain()
        let preference = WorkspaceLockPreference(defaults: domain.defaults, domainName: domain.name)
        preference.store(isOn: true)
        preference.store(timeout: .fifteenMinutes)
        #expect(preference.isOn)
        #expect(preference.timeout == .fifteenMinutes)
    }

    @Test func anUnknownStoredTimeoutReadsAsTheStandard() throws {
        let domain = try EmptyDomain()
        domain.defaults.set(7, forKey: timeoutKey)
        #expect(WorkspaceLockPreference(defaults: domain.defaults, domainName: domain.name).timeout == .fiveMinutes)
    }

    @Test func registeringTheDefaultsRegistersOffAndFiveMinutes() throws {
        let domain = try EmptyDomain()
        WorkspaceLockPreference.registerDefaults(in: domain.defaults)
        #expect(domain.defaults.object(forKey: isOnKey) as? Bool == false)
        #expect(domain.defaults.object(forKey: timeoutKey) as? Int == 5)
    }

    @Test func theTimeoutsAreOneFiveFifteenAndSixtyMinutes() {
        #expect(WorkspaceLockTimeout.allCases.map(\.rawValue) == [1, 5, 15, 60])
        #expect(WorkspaceLockTimeout.fiveMinutes.seconds == 300)
    }
}
