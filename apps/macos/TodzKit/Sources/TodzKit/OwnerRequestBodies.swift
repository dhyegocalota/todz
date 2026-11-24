struct SignInBody: Encodable {
    let identityToken: String
    let timeZone: String
}

struct TimeZoneBody: Encodable {
    let timeZone: String
}

struct NameBody: Encodable {
    let name: String
}

struct AddTasksBody: Encodable {
    let tasks: [TaskDraft]
}

struct TaskNumbersBody: Encodable {
    let numbers: [Int]
}
