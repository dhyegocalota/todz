import Foundation
import Testing
@testable import TodzKit

private let bundleFolderName = "Fixture.bundle"
private let resourcesFolderName = "Resources"
private let languageFolderExtension = "lproj"

private func bundle(holding languages: [AppLanguage]) throws -> Bundle {
    let root = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString).appending(path: bundleFolderName)
    let resources = root.appending(path: resourcesFolderName)
    try languages.forEach { language in
        try FileManager.default.createDirectory(at: resources.appending(path: "\(language.rawValue).\(languageFolderExtension)"), withIntermediateDirectories: true)
    }
    try FileManager.default.createDirectory(at: resources, withIntermediateDirectories: true)
    return try #require(Bundle(url: root))
}

@Suite struct LanguageBundleTests {
    @Test func aLanguageFindsItsOwnFolder() throws {
        let holder = try bundle(holding: [.english, .portugueseBrazil])
        let found = try LanguageBundle.of(language: .portugueseBrazil, in: holder)
        #expect(found.bundleURL.lastPathComponent == "pt-BR.lproj")
    }

    @Test func aLanguageWithNoFolderIsRefusedInsteadOfShowingAnotherOne() throws {
        let holder = try bundle(holding: [.english])
        #expect(throws: LanguageBundleError.missing(.japanese)) { try LanguageBundle.of(language: .japanese, in: holder) }
    }
}
