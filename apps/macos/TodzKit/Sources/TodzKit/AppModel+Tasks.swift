extension AppModel {
    public func addTask(title: String, projectIdentifier: String, dueDate: CalendarDate?, selection: AddedTaskSelection = .selectWhenSaved) async {
        let issue = TextCheck.issue(ofTitle: title)
        ruleIssues[.newTask(projectIdentifier: projectIdentifier)] = issue
        guard issue == nil else { return }
        let draft = TaskDraft(title: title, notes: nil, dueDate: dueDate, idempotencyKey: makeIdempotencyKey())
        selectionsAtAdd.updateValue(selectedTask, forKey: draft.idempotencyKey)
        enqueue(.add(projectIdentifier: projectIdentifier, draft: draft))
    }

    public func complete(task key: TaskKey) async {
        enqueue(.state(key, .done, at: now()))
    }

    public func reopen(task key: TaskKey) async {
        enqueue(.state(key, .open, at: now()))
    }

    public func updateTitle(task key: TaskKey, title: String) async {
        let issue = TextCheck.issue(ofTitle: title)
        ruleIssues[.taskField(key, .title)] = issue
        guard issue == nil else { return }
        enqueue(.field(key, .title(title)))
    }

    public func updateNotes(task key: TaskKey, notes: String?) async {
        let issue = notes.flatMap(TextCheck.issue(ofNotes:))
        ruleIssues[.taskField(key, .notes)] = issue
        guard issue == nil else { return }
        enqueue(.field(key, .notes(notes)))
    }

    public func commitNotes(task key: TaskKey, draft: String) async {
        let issue = TextCheck.issue(ofNotes: draft)
        ruleIssues[.taskField(key, .notes)] = issue
        guard issue == nil else {
            unsavedNotes[key] = draft
            return
        }
        unsavedNotes[key] = nil
        let isBlank = draft.allSatisfy(\.isWhitespace)
        let notes: String? = isBlank ? nil : draft
        let shownNotes = board.applying(outbox).task(projectIdentifier: key.projectIdentifier, number: key.number)?.notes
        guard notes != shownNotes else { return }
        await updateNotes(task: key, notes: notes)
    }

    public func discardUnsavedNotes(task key: TaskKey) {
        unsavedNotes[key] = nil
        ruleIssues[.taskField(key, .notes)] = nil
    }

    public func updateDueDate(task key: TaskKey, dueDate: CalendarDate?) async {
        enqueue(.field(key, .dueDate(dueDate)))
    }

    public func move(task key: TaskKey, placement: TaskPlacement) async {
        enqueue(.field(key, .placement(placement)))
    }

    public func loadHistory(task key: TaskKey) async {
        guard session != nil else { return }
        histories[key] = .loading
        do {
            let entries = try await request {
                try await service.readHistory(session: $0, projectIdentifier: key.projectIdentifier, number: key.number)
            }
            histories[key] = .loaded(entries)
        } catch {
            guard session != nil else { return }
            histories[key] = .failed
        }
    }
}
