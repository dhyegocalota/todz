import Testing
@testable import TodzKit

@Suite struct AddFieldArmingTests {
    @Test func aWindowOpenedOnTheAddFieldHasItArmed() {
        #expect(AddFieldArming(opening: .addField).isArmed)
    }

    @Test func aWindowOpenedOnTheListHasTheAddFieldDisarmed() {
        #expect(!AddFieldArming(opening: .list).isArmed)
    }

    @Test(arguments: [AddFieldArming.Event.addFieldClicked, .newTaskCommand])
    func aClickIntoTheFieldOrTheNewTaskCommandArmsIt(event: AddFieldArming.Event) {
        var arming = AddFieldArming(opening: .list)
        arming.apply(event)
        #expect(arming.isArmed)
    }

    @Test(arguments: [AddFieldArming.Event.addFieldClicked, .newTaskCommand])
    func anArmedFieldStaysArmed(event: AddFieldArming.Event) {
        var arming = AddFieldArming(opening: .addField)
        arming.apply(event)
        #expect(arming.isArmed)
    }
}
