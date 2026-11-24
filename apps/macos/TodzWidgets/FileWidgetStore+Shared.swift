import Foundation
import TodzKit

extension FileWidgetStore {
    static var shared: FileWidgetStore? {
        guard let folder = SharedFolder.of(bundle: .main) else { return nil }
        return FileWidgetStore(folder: folder)
    }
}
