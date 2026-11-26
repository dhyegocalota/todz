import Foundation
import Testing
@testable import TodzKit

@Suite struct ApplicationsMoveTests {
    private let homeDirectory = "/Users/maria"

    private func isOffered(
        bundlePath: String,
        isTranslocated: Bool = false,
        currentVersion: String = "0.2.6",
        declinedVersion: String? = nil,
        hasUpdateFeed: Bool = true,
        isDebugBuild: Bool = false
    ) -> Bool {
        ApplicationsMove.shouldOffer(
            bundlePath: bundlePath,
            isTranslocated: isTranslocated,
            homeDirectory: homeDirectory,
            currentVersion: currentVersion,
            declinedVersion: declinedVersion,
            hasUpdateFeed: hasUpdateFeed,
            isDebugBuild: isDebugBuild
        )
    }

    @Test func aBundleInTheSystemApplicationsFolderIsNotOffered() {
        #expect(!isOffered(bundlePath: "/Applications/Todz.app"))
    }

    @Test func aBundleInTheHomeApplicationsFolderIsNotOffered() {
        #expect(!isOffered(bundlePath: "/Users/maria/Applications/Todz.app"))
    }

    @Test func aBundleInDownloadsIsOffered() {
        #expect(isOffered(bundlePath: "/Users/maria/Downloads/Todz.app"))
    }

    @Test func aBundleOnADiskImageIsOffered() {
        #expect(isOffered(bundlePath: "/Volumes/Todz/Todz.app"))
    }

    @Test func aBundleInAFolderInsideApplicationsIsOffered() {
        #expect(isOffered(bundlePath: "/Applications/Utilities/Todz.app"))
    }

    @Test func aTranslocatedBundleIsOffered() {
        #expect(isOffered(bundlePath: "/private/var/folders/ab/cd/AppTranslocation/1234/d/Todz.app", isTranslocated: true))
    }

    @Test func aTranslocatedBundleIsOfferedEvenWhenItsPathLooksLikeApplications() {
        #expect(isOffered(bundlePath: "/Applications/Todz.app", isTranslocated: true))
    }

    @Test func theDeclinedVersionIsNotOfferedAgain() {
        #expect(!isOffered(bundlePath: "/Users/maria/Downloads/Todz.app", currentVersion: "0.2.6", declinedVersion: "0.2.6"))
    }

    @Test func aNewerVersionIsOfferedAfterADecline() {
        #expect(isOffered(bundlePath: "/Users/maria/Downloads/Todz.app", currentVersion: "0.2.7", declinedVersion: "0.2.6"))
    }

    @Test func aBuildWithoutAnUpdateFeedIsNeverOffered() {
        #expect(!isOffered(bundlePath: "/Users/maria/Downloads/Todz.app", hasUpdateFeed: false))
    }

    @Test func aDebugBuildIsNeverOfferedEvenWithAnUpdateFeed() {
        #expect(!isOffered(bundlePath: "/Users/maria/Downloads/Todz.app", hasUpdateFeed: true, isDebugBuild: true))
    }

    @Test func aTranslocatedDebugBuildIsNeverOffered() {
        #expect(!isOffered(bundlePath: "/private/var/folders/ab/AppTranslocation/1/d/Todz.app", isTranslocated: true, isDebugBuild: true))
    }

    @Test func aDeclineIsRememberedForThatVersionOnly() throws {
        let defaults = try emptyDefaults()
        #expect(ApplicationsMove.declinedVersion(defaults: defaults) == nil)
        ApplicationsMove.decline(version: "0.2.6", defaults: defaults)
        #expect(ApplicationsMove.declinedVersion(defaults: defaults) == "0.2.6")
        ApplicationsMove.decline(version: "0.2.7", defaults: defaults)
        #expect(ApplicationsMove.declinedVersion(defaults: defaults) == "0.2.7")
    }
}
