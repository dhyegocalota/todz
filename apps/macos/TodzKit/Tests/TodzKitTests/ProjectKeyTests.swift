import Foundation
import Testing
@testable import TodzKit

private let keyIdentifier = "key-1"
private let ownerSecret = "todz-owner_yMnKy8zNzs_Q0dLT1NXW19jZ2tvc3d7f4OHi4-Tl5uc"
private let keysWithoutAField = [
    "{\"hint\":\"\(OwnerFixtures.keyHint)\",\"created_at\":\(OwnerFixtures.createdAtMilliseconds)}",
    "{\"id\":\"\(keyIdentifier)\",\"created_at\":\(OwnerFixtures.createdAtMilliseconds)}",
    "{\"id\":\"\(keyIdentifier)\",\"hint\":\"\(OwnerFixtures.keyHint)\"}",
]
private let issuedKeysWithoutAField = [
    "{\"secret\":\"\(OwnerFixtures.keySecret)\"}",
    "{\"key\":\(OwnerFixtures.projectKeyJSON(identifier: keyIdentifier))}",
]

@Suite struct ProjectKeyTests {
    @Test func decodesAKeyWithItsCreationInEpochMilliseconds() throws {
        let key = try OwnerFixtures.decoded(ProjectKey.self, from: OwnerFixtures.projectKeyJSON(identifier: keyIdentifier))
        #expect(key == OwnerFixtures.projectKey(identifier: keyIdentifier))
        #expect(key.id == keyIdentifier)
        #expect(key.createdAt.timeIntervalSince1970 == 1_795_000_000.123)
    }

    @Test func decodesAnIssuedKeyWithItsSecret() throws {
        let issued = try OwnerFixtures.decoded(IssuedKey.self, from: OwnerFixtures.issuedKeyJSON(identifier: keyIdentifier))
        #expect(issued == IssuedKey(key: OwnerFixtures.projectKey(identifier: keyIdentifier), secret: OwnerFixtures.keySecret))
    }

    @Test func decodesAnIssuedOwnerKeyWithItsSecret() throws {
        let json = "{\"key\":\(OwnerFixtures.projectKeyJSON(identifier: keyIdentifier)),\"secret\":\"\(ownerSecret)\"}"
        let issued = try OwnerFixtures.decoded(IssuedKey.self, from: json)
        #expect(issued == IssuedKey(key: OwnerFixtures.projectKey(identifier: keyIdentifier), secret: ownerSecret))
    }

    @Test(arguments: ["todz-owner_", "todz-admin_abc", "todz-owner_a b", "owner_abc"])
    func refusesASecretThatIsNeitherAProjectNorAnOwnerKey(secret: String) {
        let json = "{\"key\":\(OwnerFixtures.projectKeyJSON(identifier: keyIdentifier)),\"secret\":\"\(secret)\"}"
        #expect(throws: DecodingError.self) { try OwnerFixtures.decoded(IssuedKey.self, from: json) }
    }

    @Test(arguments: keysWithoutAField)
    func refusesAKeyWithoutAField(json: String) {
        #expect(throws: DecodingError.self) { try OwnerFixtures.decoded(ProjectKey.self, from: json) }
    }

    @Test(arguments: issuedKeysWithoutAField)
    func refusesAnIssuedKeyWithoutAField(json: String) {
        #expect(throws: DecodingError.self) { try OwnerFixtures.decoded(IssuedKey.self, from: json) }
    }

    @Test func aKeyDecodesEncodesAndDecodesEqual() throws {
        let key = try OwnerFixtures.decoded(ProjectKey.self, from: OwnerFixtures.projectKeyJSON(identifier: keyIdentifier))
        let encoded = try OwnerCoding.encoder().encode(key)
        #expect(try OwnerCoding.decoder().decode(ProjectKey.self, from: encoded) == key)
        let sent = try JSONSerialization.jsonObject(with: encoded) as? NSDictionary
        let expected = try JSONSerialization.jsonObject(with: Data(OwnerFixtures.projectKeyJSON(identifier: keyIdentifier).utf8)) as? NSDictionary
        #expect(sent == expected)
    }
}
