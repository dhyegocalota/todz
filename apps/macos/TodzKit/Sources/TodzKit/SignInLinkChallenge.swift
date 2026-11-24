import CryptoKit
import Foundation

private let verifierByteCount = 32
private let base64Replacements = [("+", "-"), ("/", "_"), ("=", "")]
private let hexByteFormat = "%02x"

enum SignInLinkChallenge {
    static func newVerifier() -> String {
        let bytes = Data((0..<verifierByteCount).map { _ in UInt8.random(in: .min ... .max) })
        return base64Replacements.reduce(bytes.base64EncodedString()) { text, replacement in
            text.replacingOccurrences(of: replacement.0, with: replacement.1)
        }
    }

    static func challenge(for verifier: String) -> String {
        SHA256.hash(data: Data(verifier.utf8)).map { String(format: hexByteFormat, $0) }.joined()
    }
}
