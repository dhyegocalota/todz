public enum TaskState: String, Codable, Sendable, CaseIterable {
    case open
    case done
}

public enum ActorKind: String, Codable, Sendable, CaseIterable {
    case owner
    case agent
}

public enum TaskField: String, Codable, Sendable, CaseIterable {
    case title
    case notes
    case dueDate = "due_date"
    case order
}

public enum HistoryAction: String, Codable, Sendable, CaseIterable {
    case created
    case updated
    case completed
    case reopened
}

public enum PlacementKind: String, Codable, Sendable, CaseIterable {
    case first
    case last
    case before
    case after
}

public enum RuleIssue: String, Codable, Sendable, CaseIterable {
    case titleEmpty = "title_empty"
    case titleTooLong = "title_too_long"
    case notesTooLong = "notes_too_long"
    case completionNoteTooLong = "completion_note_too_long"
    case dueDateInvalid = "due_date_invalid"
    case batchEmpty = "batch_empty"
    case batchTooLarge = "batch_too_large"
    case idempotencyKeyInvalid = "idempotency_key_invalid"
    case clientNameInvalid = "client_name_invalid"
    case taskNumberInvalid = "task_number_invalid"
    case nothingToUpdate = "nothing_to_update"
    case placementAnchorInvalid = "placement_anchor_invalid"
    case searchTextTooLong = "search_text_too_long"
    case limitInvalid = "limit_invalid"
    case nameEmpty = "name_empty"
    case nameTooLong = "name_too_long"
    case titleInvalid = "title_invalid"
    case notesInvalid = "notes_invalid"
    case completionNoteInvalid = "completion_note_invalid"
    case nameInvalid = "name_invalid"
    case orderKeyTooLong = "order_key_too_long"
    case confirmationMismatch = "confirmation_mismatch"
}
