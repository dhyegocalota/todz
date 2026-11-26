import Foundation
import Testing
@testable import TodzKit

private let firstDay = Date(timeIntervalSince1970: 1_795_000_000)
private let nextDay = firstDay.addingTimeInterval(24 * 60 * 60)
private let appVersion = "0.2.1"
private let macosMajor = 15
private let rotationSeconds: TimeInterval = 30 * 24 * 60 * 60
private let rollupSizeMaxBytes = 1024
private let apiAddress = "https://api.todz.app"

private struct SharingDomain {
    let domain: EmptyDomain
    let preference: UsageSharingPreference
    let sharing: UsageSharing

    init(makeIdentifier: @escaping () -> String = { UUID().uuidString.lowercased() }) throws {
        domain = try EmptyDomain()
        preference = UsageSharingPreference(defaults: domain.defaults, domainName: domain.name)
        sharing = UsageSharing(defaults: domain.defaults, domainName: domain.name, timeZone: .gmt, makeIdentifier: makeIdentifier)
    }
}

private final class IdentifierSource {
    private(set) var issued = 0

    func next() -> String {
        issued += 1
        return "identifier-\(issued)"
    }
}

@Suite struct UsageSharingPreferenceTests {
    @Test func aFreshDomainIsOffAndNotAsked() throws {
        let shared = try SharingDomain()
        #expect(!shared.preference.isOn)
        #expect(!shared.preference.hasBeenAsked)
    }

    @Test func theRegisteredDefaultIsOff() throws {
        let shared = try SharingDomain()
        UsageSharingPreference.registerDefaults(in: shared.domain.defaults)
        #expect(shared.domain.defaults.object(forKey: UsageSharingPreference.isOnStorageKey) as? Bool == false)
        #expect(!shared.preference.isOn)
    }

    @Test func answeringYesTurnsItOnAndRemembersTheAsk() throws {
        let shared = try SharingDomain()
        shared.preference.answer(isSharing: true)
        #expect(shared.preference.isOn)
        #expect(shared.preference.hasBeenAsked)
    }

    @Test func answeringNoKeepsItOffAndRemembersTheAsk() throws {
        let shared = try SharingDomain()
        shared.preference.answer(isSharing: false)
        #expect(!shared.preference.isOn)
        #expect(shared.preference.hasBeenAsked)
    }
}

@Suite struct UsageInstallIdentifierTests {
    @Test func theIdentifierStaysTheSameInsideThirtyDays() throws {
        let domain = try EmptyDomain()
        let source = IdentifierSource()
        let identifier = UsageInstallIdentifier(defaults: domain.defaults, domainName: domain.name, makeIdentifier: source.next)
        let first = identifier.current(at: firstDay)
        #expect(identifier.current(at: firstDay.addingTimeInterval(rotationSeconds - 1)) == first)
        #expect(source.issued == 1)
    }

    @Test func theIdentifierRotatesAfterThirtyDays() throws {
        let domain = try EmptyDomain()
        let source = IdentifierSource()
        let identifier = UsageInstallIdentifier(defaults: domain.defaults, domainName: domain.name, makeIdentifier: source.next)
        let first = identifier.current(at: firstDay)
        let second = identifier.current(at: firstDay.addingTimeInterval(rotationSeconds))
        #expect(second != first)
        #expect(identifier.current(at: firstDay.addingTimeInterval(rotationSeconds + 1)) == second)
    }
}

@Suite struct UsageSharingTests {
    @Test func nothingIsRecordedWhileTheSwitchIsOff() throws {
        let shared = try SharingDomain()
        shared.sharing.record(.popoverOpened, at: firstDay)
        #expect(shared.sharing.dueRollup(at: nextDay, appVersion: appVersion, macosMajor: macosMajor) == nil)
        #expect(shared.domain.defaults.persistentDomain(forName: shared.domain.name)?[UsageSharing.tallyCountsStorageKey] == nil)
    }

    @Test func aFinishedDayBecomesOneRollupOfCountsOnly() throws {
        let shared = try SharingDomain(makeIdentifier: { "an-identifier" })
        shared.preference.answer(isSharing: true)
        shared.sharing.record(.popoverOpened, at: firstDay)
        shared.sharing.record(.popoverOpened, at: firstDay)
        shared.sharing.record(.dayClosed, at: firstDay)
        let rollup = try #require(shared.sharing.dueRollup(at: nextDay, appVersion: appVersion, macosMajor: macosMajor))
        #expect(rollup.counts == ["popover_opened": 2, "day_closed": 1])
        #expect(rollup.installId == "an-identifier")
        #expect(rollup.appVersion == appVersion)
        #expect(rollup.macosMajor == macosMajor)
    }

    @Test func theCurrentDayIsNotDueYet() throws {
        let shared = try SharingDomain()
        shared.preference.answer(isSharing: true)
        shared.sharing.record(.popoverOpened, at: firstDay)
        #expect(shared.sharing.dueRollup(at: firstDay, appVersion: appVersion, macosMajor: macosMajor) == nil)
    }

    @Test func aSentDayIsNotDueAgain() throws {
        let shared = try SharingDomain()
        shared.preference.answer(isSharing: true)
        shared.sharing.record(.popoverOpened, at: firstDay)
        shared.sharing.markSent()
        #expect(shared.sharing.dueRollup(at: nextDay, appVersion: appVersion, macosMajor: macosMajor) == nil)
    }

    @Test func theRollupCarriesCountsAndNothingElse() throws {
        let rollup = UsageRollup(
            installId: "an-identifier",
            appVersion: appVersion,
            macosMajor: macosMajor,
            tally: [.popoverOpened: 3, .shortcutUsed: 99_999]
        )
        let request = try rollup.request(baseURL: try #require(URL(string: apiAddress)))
        let body = try #require(request.httpBody)
        let object = try #require(try JSONSerialization.jsonObject(with: body) as? [String: Any])
        #expect(Set(object.keys) == ["installId", "appVersion", "macosMajor", "counts"])
        let counts = try #require(object["counts"] as? [String: Int])
        #expect(Set(counts.keys).isSubset(of: Set(UsageEvent.allCases.map(\.rawValue))))
        #expect(counts["shortcut_used"] == UsageRollup.countMax)
        #expect(body.count < rollupSizeMaxBytes)
        #expect(request.url?.absoluteString == "\(apiAddress)/telemetry/usage")
        #expect(request.httpMethod == "POST")
    }

    @Test func theFullestRollupStaysUnderOneKilobyte() throws {
        let fullest = UsageRollup(
            installId: UUID().uuidString.lowercased(),
            appVersion: "999.999.999",
            macosMajor: 99,
            tally: Dictionary(uniqueKeysWithValues: UsageEvent.allCases.map { event in (event, UsageRollup.countMax) })
        )
        let request = try fullest.request(baseURL: try #require(URL(string: apiAddress)))
        #expect(try #require(request.httpBody).count < rollupSizeMaxBytes)
    }
}
