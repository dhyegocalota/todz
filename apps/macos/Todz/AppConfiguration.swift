import Foundation
import TodzKit

private let baseURLKey = "TodzAPIBaseURL"

enum AppConfiguration {
    static var baseURL: URL {
        guard let text = Bundle.main.object(forInfoDictionaryKey: baseURLKey) as? String else {
            fatalError("\(baseURLKey) is missing from the app's Info.plist")
        }
        guard let address = URL(string: text), address.host() != nil else {
            fatalError("\(baseURLKey) in the app's Info.plist is not a URL with a host: \(text)")
        }
        return address
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
