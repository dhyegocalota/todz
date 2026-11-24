import Foundation
import TodzKit

extension FileWidgetStore {
    static var shared: FileWidgetStore? {
        guard let sharedFolder = SharedFolder.of(bundle: .main), let folder = SharedFolder.owned(sharedFolder) else { return nil }
        return FileWidgetStore(folder: folder)
    }
}
