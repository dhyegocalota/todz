import Foundation
import TodzKit

private let baseURLKey = "TodzAPIBaseURL"

enum AppConfiguration {
    static var defaultURL: ServerAddress {
        guard let text = Bundle.main.object(forInfoDictionaryKey: baseURLKey) as? String else {
            fatalError("\(baseURLKey) is missing from the app's Info.plist")
        }
        switch ServerAddress.checked(text: text) {
        case let .success(address): return address
        case let .failure(issue): fatalError("\(baseURLKey) in the app's Info.plist is not a server address (\(issue)): \(text)")
        }
    }

    static var appVersion: String {
        AppVersion.required(bundle: .main)
    }

    static var linkScheme: AppLinkScheme {
        AppLinkScheme.required(bundle: .main)
    }

    static var defaultsDomain: String {
        guard let bundleIdentifier = Bundle.main.bundleIdentifier else {
            fatalError("The app's bundle has no identifier, so its defaults domain is unknown")
        }
        return bundleIdentifier
    }

    static var sessionFolder: URL {
        do {
            return try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
        } catch {
            fatalError("The app's Application Support folder cannot be opened: \(error.localizedDescription)")
        }
    }

    static var widgetStore: any WidgetStore {
        guard let sharedFolder = SharedFolder.of(bundle: .main), let folder = SharedFolder.created(sharedFolder) else { return UnavailableWidgetStore() }
        return FileWidgetStore(folder: folder)
    }
}
