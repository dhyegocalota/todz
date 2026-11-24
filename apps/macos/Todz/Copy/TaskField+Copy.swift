import TodzKit

extension TaskField {
    var copy: String {
        switch self {
        case .title: HistoryCopy.fieldTitle
        case .notes: HistoryCopy.fieldNotes
        case .dueDate: HistoryCopy.fieldDueDate
        case .order: HistoryCopy.fieldOrder
        }
    }
}
