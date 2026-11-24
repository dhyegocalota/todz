import Foundation
import Testing
@testable import TodzKit

private let vectorVerifier = String(repeating: "A", count: 43)
private let vectorChallenge = "0f007385b6f9d4b7eeb2748605afe1a984a0a3bfa3f014d09e2a784ce9e5cd1a"
private let verifierLength = 43
private let verifierCount = 20

@Suite struct SignInLinkChallengeTests {
    @Test func theChallengeIsTheLowerCaseHexSha256OfTheVerifierText() {
        #expect(SignInLinkChallenge.challenge(for: vectorVerifier) == vectorChallenge)
    }

    @Test func aVerifierIsFortyThreeBase64UrlCharactersAndNeverRepeats() {
        let verifiers = (0..<verifierCount).map { _ in SignInLinkChallenge.newVerifier() }
        #expect(verifiers.allSatisfy { $0.count == verifierLength && $0.wholeMatch(of: /[A-Za-z0-9_-]+/) != nil })
        #expect(Set(verifiers).count == verifierCount)
    }
}
