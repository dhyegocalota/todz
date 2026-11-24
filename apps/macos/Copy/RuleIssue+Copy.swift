import TodzKit

extension RuleIssue {
    var copy: String {
        switch self {
        case .titleEmpty: ErrorCopy.titleEmpty
        case .titleTooLong: ErrorCopy.titleTooLong
        case .notesTooLong: ErrorCopy.notesTooLong
        case .nameEmpty: ErrorCopy.nameEmpty
        case .nameTooLong: ErrorCopy.nameTooLong
        case .dueDateInvalid: ErrorCopy.dueDateInvalid
        case .completionNoteTooLong, .batchEmpty, .batchTooLarge, .idempotencyKeyInvalid, .clientNameInvalid, .taskNumberInvalid,
            .nothingToUpdate, .placementAnchorInvalid, .searchTextTooLong, .limitInvalid, .titleInvalid, .notesInvalid,
            .completionNoteInvalid, .nameInvalid, .orderKeyTooLong:
            ErrorCopy.ruleUnexpected
        }
    }
}
