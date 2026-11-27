import Testing
@testable import TodzKit

private let inbox = Project(identifier: "inbox", name: "Inbox", isInbox: true, createdAt: fixedInstant)

private func task(_ number: Int, state: TaskState = .open) -> BoardTask {
    BoardTask(project: inbox, task: MutableTask(number: number, state: state, completedAt: state == .done ? fixedInstant : nil).record)
}

private func day(
    open: [BoardTask] = [],
    doneToday: [BoardTask] = [],
    pendingCount: Int = 0,
    isClosingDay: Bool = false,
    load: MenuBarLoad = .loaded
) -> MenuBarDay {
    MenuBarDay(open: open, doneToday: doneToday, pendingCount: pendingCount, isClosingDay: isClosingDay, load: load)
}

@Suite struct MenuBarDayTests {
    @Test func nothingOpenNothingDoneAndNothingPendingIsEmpty() {
        #expect(day().screen == .empty)
    }

    @Test func nothingOpenWithADoneTaskIsAllDone() {
        #expect(day(doneToday: [task(1, state: .done)]).screen == .allDone)
    }

    @Test func anOpenTaskIsActive() {
        #expect(day(open: [task(1)]).screen == .active)
    }

    @Test func pendingAddsAloneAreNotEmpty() {
        #expect(day(pendingCount: 1).screen == .active)
        #expect(day(doneToday: [task(1, state: .done)], pendingCount: 1).screen == .active)
    }

    @Test func aFailedLoadBeatsALoadingOne() {
        #expect(day(open: [task(1)], load: .failed).screen == .failed)
        #expect(day(load: .loading).screen == .loading)
    }

    @Test func closingTheDayBeatsActive() {
        #expect(day(open: [task(1)], isClosingDay: true).screen == .closingDay)
    }

    @Test func closingTheDayWithNothingLeftIsDayClosed() {
        #expect(day(doneToday: [task(1, state: .done)], isClosingDay: true).screen == .dayClosed)
        #expect(day(pendingCount: 1, isClosingDay: true).screen == .closingDay)
    }

    @Test func theFirstOpenTaskIsUpNextAndTheRestIsTheQueue() {
        let model = day(open: [task(1), task(2), task(3)])
        #expect(model.upNext == task(1))
        #expect(model.queue == [task(2), task(3)])
    }

    @Test func aJustCheckedFirstRowKeepsTheCardUntilTheLingerEnds() {
        let lingering = day(open: [task(1, state: .done), task(2)])
        #expect(lingering.upNext == task(1, state: .done))
        #expect(lingering.queue == [task(2)])
        let ended = day(open: [task(2)], doneToday: [task(1, state: .done)])
        #expect(ended.upNext == task(2))
    }

    @Test func closingTheDayDrawsNoCardAndEveryOpenRowIsInTheQueue() {
        let model = day(open: [task(1), task(2)], isClosingDay: true)
        #expect(model.upNext == nil)
        #expect(model.queue == [task(1), task(2)])
    }

    @Test func countsLeaveOutTheLingeringTaskAndCountItAsDone() {
        let model = day(open: [task(1, state: .done), task(2), task(3)], doneToday: [task(4, state: .done)])
        #expect(model.leftCount == 2)
        #expect(model.doneCount == 2)
    }

    @Test func theDoneTodayTasksAreKeptForTheDisclosure() {
        #expect(day(open: [task(1)], doneToday: [task(2, state: .done)]).doneToday == [task(2, state: .done)])
    }

    @Test func progressIsZeroWithNothingAndGrowsToOne() {
        #expect(day().progress == 0)
        #expect(day(open: [task(1)]).progress == 0)
        #expect(day(open: [task(1)], doneToday: [task(2, state: .done)]).progress == 0.5)
        #expect(day(doneToday: [task(2, state: .done)]).progress == 1)
    }
}
