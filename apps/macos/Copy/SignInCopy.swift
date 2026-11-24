import Foundation
import TodzKit

enum SignInCopy {
    static let title = "Welcome to todz"
    static let subtitle = "Your tasks, shared with your agents."
    static let identityPlaceholder = "Identity"
    static let signIn = "Sign In"
    static let signingIn = "Signing in…"
    static let developmentNotice = "Development sign-in. Sign in with Apple comes later."
    static let identityRequired = "Enter an identity to sign in."
    static let identityFormat = "Use up to \(IdentityFormat.maxLength) letters, digits, dots, dashes or underscores."
    static let identityRejected = "That identity wasn't accepted."
    static let signInUnavailable = "Sign-in isn't available on this server."
    static let sessionEnded = "Your session has ended. Sign in again."
    static let sessionUnreadable = "Your saved session couldn't be read. Sign in again."
    static let timeZoneInvalid = "This Mac's time zone wasn't accepted."
    static let gettingReady = "Getting ready…"
    static let emailPlaceholder = "Email"
    static let emailLabel = "Email address"
    static let sendLink = "Send Link"
    static let sendingLink = "Sending…"
    static let emailRequired = "Enter your email address to continue."
    static let emailFormat = "Enter a valid email address."
    static let linkPromise = "We'll email you a link. No password needed."
    static let inboxTitle = "Check your inbox"
    static let inboxSubtitle = "We sent a sign-in link to"
    static let sendAgain = "Send Again"
    static let useDifferentEmail = "Use a Different Email"
    static let tooManyLinks = "Too many links. Wait a few minutes and try again."
    static let linkRejected = "That link has expired or was already used. Send a new one."
    static let linkNotRequested = "Open the link on the Mac that asked for it, or send a new one."

    static var linkLifetime: String {
        let minutes = Int(Measurement(value: SignInLinkTiming.lifetime, unit: UnitDuration.seconds).converted(to: .minutes).value)
        return InflectedCopy.text("The link works for ^[\(minutes) minute](inflect: true), on this Mac only.")
    }

    static func sendAgainWaiting(seconds: Int) -> String {
        InflectedCopy.text("You can send another in ^[\(seconds) second](inflect: true).")
    }

    static func sessionEndedWaiting(count: Int) -> String {
        InflectedCopy.text("Your session has ended. Sign in again to send ^[\(count) waiting change](inflect: true).")
    }
}
