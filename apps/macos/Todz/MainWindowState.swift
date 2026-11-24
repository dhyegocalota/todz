import Observation
import TodzKit

@MainActor @Observable final class MainWindowState {
    var isInspectorPresented = true
    var sheet: NameSheetKind?
    var focusRequest: MainWindowFocus?

    func requestNewTask(model: AppModel) {
        let hasNoAddField = model.selectedItem == .upcoming || model.selectedItem == .done
        if hasNoAddField { model.selectedItem = .inbox }
        focusRequest = .addField
    }

    func openInspectorTitle() {
        isInspectorPresented = true
        focusRequest = .inspectorTitle
    }
}
