import Foundation
@testable import TodzKit

let bigProjectTaskCount = 5_000
let bigProjectOtherProjectCount = 19
let bigProjectInboxIdentifier = "acme-inbox"
private let datedEvery = 4

extension AppModelHarness {
    func seedBigProject() {
        seedWorkspace(name: "acme", projectNames: (1...bigProjectOtherProjectCount).map { "project-\($0)" })
        service.tasksOfProject[bigProjectInboxIdentifier] = (1...bigProjectTaskCount).map { number in
            let isOpen = number.isMultiple(of: 2)
            let isDated = number.isMultiple(of: datedEvery)
            return MutableTask(
                number: number,
                title: "Task \(number)",
                dueDate: isDated ? CalendarDate(year: 2026, month: 12, day: 1 + number % 20) : nil,
                state: isOpen ? .open : .done,
                orderKey: "a\(number)",
                completedAt: isOpen ? nil : fixedInstant.addingTimeInterval(TimeInterval(-number))
            ).record
        }
    }

    func seedOneMoreBigProjectTask() {
        service.tasksOfProject[bigProjectInboxIdentifier]?.append(MutableTask(number: bigProjectTaskCount + 1, title: "One more").record)
    }
}
