import Foundation
import TodzKit

enum SignInCopy {
    static var title: String { Localized.text("Welcome to todz") }
    static var subtitle: String { Localized.text("Your tasks, shared with your agents.") }
    static var identityPlaceholder: String { Localized.text("Identity") }
    static var signIn: String { Localized.text("Sign In") }
    static var signingIn: String { Localized.text("Signing in…") }
    static var developmentNotice: String { Localized.text("Development sign-in. Sign in with Apple comes later.") }
    static var identityRequired: String { Localized.text("Enter an identity to sign in.") }
    static var identityFormat: String { Localized.text("Use up to \(IdentityFormat.maxLength) letters, digits, dots, dashes or underscores.") }
    static var identityRejected: String { Localized.text("That identity wasn't accepted.") }
    static var signInUnavailable: String { Localized.text("Sign-in isn't available on this server.") }
    static var sessionEnded: String { Localized.text("Your session has ended. Sign in again.") }
    static var sessionUnreadable: String { Localized.text("Your saved session couldn't be read. Sign in again.") }
    static var timeZoneInvalid: String { Localized.text("This Mac's time zone wasn't accepted.") }
    static var gettingReady: String { Localized.text("Getting ready…") }
    static var emailPlaceholder: String { Localized.text("Email") }
    static var emailLabel: String { Localized.text("Email address") }
    static var sendLink: String { Localized.text("Send Link") }
    static var sendingLink: String { Localized.text("Sending…") }
    static var emailRequired: String { Localized.text("Enter your email address to continue.") }
    static var emailFormat: String { Localized.text("Enter a valid email address.") }
    static var linkPromise: String { Localized.text("We'll email you a link. No password needed.") }
    static var inboxTitle: String { Localized.text("Check your inbox") }
    static var inboxSubtitle: String { Localized.text("We sent a sign-in link to") }
    static var codeLabel: String { Localized.text("Sign-in code") }
    static var codeHint: String { Localized.text("Enter the six digits from the email we sent you.") }
    static var resendCode: String { Localized.text("Resend code") }
    static var codeRejected: String { Localized.text("That code didn't work. Check it, or ask for a new one.") }
    static var codeLockedBare: String { Localized.text("Too many tries. Use the link in the email or ask for a new code.") }
    static var useDifferentEmail: String { Localized.text("Use a Different Email") }
    static var signInRefused: String { Localized.text("Too many tries. Wait a minute, then try again.") }
    static var linkRefused: String { Localized.text("Couldn't sign in with that link. Wait a minute, then open it from the email again.") }
    static var appTooOld: String { Localized.text("Update todz to sign in.") }
    static var challengeRequired: String { Localized.text("Complete the check first.") }
    static var challengeLabel: String { Localized.text("Security check") }
    static var linkRejected: String { Localized.text("That link has expired or was already used. Send a new one.") }
    static var linkNotRequested: String { Localized.text("Open the link on the Mac that asked for it, or send a new one.") }

    static var serverDisclosureHint: String { Localized.text("Change the server todz signs in to.") }
    static var cloudSpotsLine: AttributedString {
        Localized.attributed("Free todz cloud spots are extremely limited. You can always [run your own server](\(SelfHostAddress.url.absoluteString)).")
    }

    static func serverDisclosure(server: String) -> String {
        Localized.text("Server: \(server)")
    }

    static var linkLifetime: String {
        let minutes = Int(Measurement(value: SignInLinkTiming.lifetime, unit: UnitDuration.seconds).converted(to: .minutes).value)
        return Localized.text("The link works for \(minutes) minutes, on this Mac only.")
    }

    static func codeLocked(retryAfterSeconds: Int?) -> String {
        guard let retryAfterSeconds else { return codeLockedBare }
        let wait = Duration.seconds(retryAfterSeconds).formatted(.units(allowed: [.hours, .minutes, .seconds], width: .wide).locale(Localized.locale))
        return Localized.text("Too many tries. Use the link in the email or ask for a new code. Try again in \(wait).")
    }

    static func sendAgainWaiting(seconds: Int) -> String {
        Localized.text("You can send another in \(seconds) seconds.")
    }

    static func sessionEndedWaiting(count: Int) -> String {
        Localized.text("Your session has ended. Sign in again to send \(count) waiting changes.")
    }
}
