extension AppModel {
    public func addTask(title: String, projectIdentifier: String, dueDate: CalendarDate?) async {
        let draft = TaskDraft(title: title, notes: nil, dueDate: dueDate, idempotencyKey: makeIdempotencyKey())
        await submit(draft: draft, projectIdentifier: projectIdentifier)
    }

    public func complete(task key: TaskKey) async {
        let completed = await write(target: .taskField(key, .state), retry: { await self.complete(task: key) }) {
            try await service.completeTasks(session: $0, projectIdentifier: key.projectIdentifier, numbers: [key.number])
        }
        guard let completed else { return }
        completed.forEach { board.replace(projectIdentifier: key.projectIdentifier, task: $0.task) }
    }

    public func reopen(task key: TaskKey) async {
        let reopened = await write(target: .taskField(key, .state), retry: { await self.reopen(task: key) }) {
            try await service.reopenTasks(session: $0, projectIdentifier: key.projectIdentifier, numbers: [key.number])
        }
        guard let reopened else { return }
        reopened.forEach { board.replace(projectIdentifier: key.projectIdentifier, task: $0.task) }
    }

    public func updateTitle(task key: TaskKey, title: String) async {
        await update(task: key, field: .title, patch: .title(title))
    }

    public func updateNotes(task key: TaskKey, notes: String?) async {
        await update(task: key, field: .notes, patch: .notes(notes))
    }

    public func updateDueDate(task key: TaskKey, dueDate: CalendarDate?) async {
        await update(task: key, field: .dueDate, patch: .dueDate(dueDate))
    }

    public func move(task key: TaskKey, placement: TaskPlacement) async {
        await update(task: key, field: .order, patch: .placement(placement))
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

    private func submit(draft: TaskDraft, projectIdentifier: String) async {
        let target = WriteTarget.newTask(projectIdentifier: projectIdentifier)
        let added = await write(target: target, retry: { await self.submit(draft: draft, projectIdentifier: projectIdentifier) }) {
            try await service.addTasks(session: $0, projectIdentifier: projectIdentifier, drafts: [draft])
        }
        guard let task = added?.first?.task else { return }
        board.replace(projectIdentifier: projectIdentifier, task: task)
        selectedTask = TaskKey(projectIdentifier: projectIdentifier, number: task.number)
    }

    private func update(task key: TaskKey, field: TaskWriteField, patch: TaskPatch) async {
        let target = WriteTarget.taskField(key, field)
        let updated = await write(target: target, retry: { await self.update(task: key, field: field, patch: patch) }) {
            try await service.updateTask(session: $0, projectIdentifier: key.projectIdentifier, number: key.number, patch: patch)
        }
        guard let updated else { return }
        board.replace(projectIdentifier: key.projectIdentifier, task: updated)
    }
}
