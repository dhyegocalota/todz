import Testing
@testable import TodzKit

private let inUseText = "https://todz.example.com"
private let newText = "http://localhost:8791"

private func address(_ text: String) throws -> ServerAddress {
    try ServerAddress.checked(text: text).get()
}

private func checking() throws -> ServerSwitchFlow {
    var flow = ServerSwitchFlow()
    _ = flow.submit(text: newText, serverURL: try address(inUseText))
    return flow
}

@Suite struct ServerSwitchFlowTests {
    @Test func anAddressWithoutASchemeIsRefusedAndNothingIsProbed() throws {
        var flow = ServerSwitchFlow()
        let toProbe = flow.submit(text: "todz.example.com", serverURL: try address(inUseText))
        #expect(flow.state == .refused(.missingScheme))
        #expect(toProbe == nil)
    }

    @Test func aValidAddressStartsChecking() throws {
        var flow = ServerSwitchFlow()
        let toProbe = flow.submit(text: newText, serverURL: try address(inUseText))
        let expected = try address(newText)
        #expect(flow.state == .checking)
        #expect(toProbe == expected)
    }

    @Test func theAddressInUseIsDecidedBeforeAnyProbe() throws {
        var flow = ServerSwitchFlow()
        let toProbe = flow.submit(text: " https://Todz.Example.com/ ", serverURL: try address(inUseText))
        #expect(flow.state == .alreadyInUse)
        #expect(toProbe == nil)
    }

    @Test func aMatchSignedOutWithNothingWaitingSwitchesAtOnce() throws {
        var flow = try checking()
        flow.receive(outcome: .matches, isSignedIn: false, waitingChanges: 0)
        #expect(flow.state == .switching)
    }

    @Test func aMatchSignedInAsksFirst() throws {
        var flow = try checking()
        flow.receive(outcome: .matches, isSignedIn: true, waitingChanges: 0)
        #expect(flow.state == .confirming(losing: 0, signedIn: true))
    }

    @Test func aMatchWithChangesWaitingAsksFirstEvenSignedOut() throws {
        var flow = try checking()
        flow.receive(outcome: .matches, isSignedIn: false, waitingChanges: 2)
        #expect(flow.state == .confirming(losing: 2, signedIn: false))
    }

    @Test(arguments: [ServerProbeOutcome.notTodz, .unreachable])
    func aServerThatDoesNotAnswerAsTodzIsNotTodz(outcome: ServerProbeOutcome) throws {
        var flow = try checking()
        flow.receive(outcome: outcome, isSignedIn: true, waitingChanges: 1)
        #expect(flow.state == .notTodz)
    }

    @Test func aServerAnsweringAsAnotherOriginSaysWhichAndDoesNotSwitch() throws {
        var flow = try checking()
        flow.receive(outcome: .answersAs(origin: "http://localhost:8787"), isSignedIn: true, waitingChanges: 0)
        #expect(flow.state == .answersAs(origin: "http://localhost:8787"))
    }

    @Test func cancellingTheCheckGoesBackToIdle() throws {
        var flow = try checking()
        flow.cancel()
        #expect(flow.state == .idle)
    }

    @Test(arguments: [ServerProbeOutcome.unreachable, .notTodz, .matches, .answersAs(origin: "http://localhost:8787")])
    func anOutcomeArrivingAfterCancelIsIgnored(outcome: ServerProbeOutcome) throws {
        var flow = try checking()
        flow.cancel()
        flow.receive(outcome: outcome, isSignedIn: true, waitingChanges: 3)
        #expect(flow.state == .idle)
    }

    @Test func aSecondSubmitWhileSwitchingIsIgnored() throws {
        var flow = try checking()
        flow.receive(outcome: .matches, isSignedIn: false, waitingChanges: 0)
        let toProbe = flow.submit(text: "https://other.example.com", serverURL: try address(inUseText))
        #expect(flow.state == .switching)
        #expect(toProbe == nil)
    }

    @Test func confirmingMovesOnToSwitchingAndDecliningGoesBackToIdle() throws {
        var confirmed = try checking()
        confirmed.receive(outcome: .matches, isSignedIn: true, waitingChanges: 0)
        confirmed.confirm()
        #expect(confirmed.state == .switching)
        var declined = try checking()
        declined.receive(outcome: .matches, isSignedIn: true, waitingChanges: 0)
        declined.decline()
        #expect(declined.state == .idle)
    }

    @Test func usingTheDefaultSkipsTheProbeAndFollowsTheSameRules() {
        var signedOut = ServerSwitchFlow()
        signedOut.useDefault(isSignedIn: false, waitingChanges: 0)
        #expect(signedOut.state == .switching)
        var signedIn = ServerSwitchFlow()
        signedIn.useDefault(isSignedIn: true, waitingChanges: 4)
        #expect(signedIn.state == .confirming(losing: 4, signedIn: true))
    }

    @Test(arguments: [
        (ServerSwitchResult.eraseFailed, ServerSwitchState.failed(.eraseFailed)),
        (.busy, .failed(.busy)),
        (.alreadyInUse, .alreadyInUse),
    ])
    func aSwitchThatDidNotHappenSaysWhy(result: ServerSwitchResult, expected: ServerSwitchState) throws {
        var flow = try checking()
        flow.receive(outcome: .matches, isSignedIn: false, waitingChanges: 0)
        flow.finish(result: result)
        #expect(flow.state == expected)
    }

    @Test func aFinishedSwitchIsSwitched() throws {
        var flow = try checking()
        flow.receive(outcome: .matches, isSignedIn: false, waitingChanges: 0)
        flow.finish(result: .switched)
        #expect(flow.state == .switched)
    }

    @Test func closingClearsEveryLineACheckAndAQuestionButNotASwitchInFlight() throws {
        let inUse = try address(inUseText)
        var refused = ServerSwitchFlow()
        _ = refused.submit(text: "todz.example.com", serverURL: inUse)
        var alreadyInUse = ServerSwitchFlow()
        _ = alreadyInUse.submit(text: inUseText, serverURL: inUse)
        var notTodz = try checking()
        notTodz.receive(outcome: .notTodz, isSignedIn: false, waitingChanges: 0)
        var confirming = try checking()
        confirming.receive(outcome: .matches, isSignedIn: true, waitingChanges: 0)
        var switched = try checking()
        switched.receive(outcome: .matches, isSignedIn: false, waitingChanges: 0)
        switched.finish(result: .switched)
        var failed = try checking()
        failed.receive(outcome: .matches, isSignedIn: false, waitingChanges: 0)
        failed.finish(result: .eraseFailed)
        let closedStates = [refused, alreadyInUse, notTodz, try checking(), confirming, switched, failed].map { flow in
            var closing = flow
            closing.close()
            return closing.state
        }
        #expect(closedStates.allSatisfy { $0 == .idle })
        var switching = try checking()
        switching.receive(outcome: .matches, isSignedIn: false, waitingChanges: 0)
        switching.close()
        #expect(switching.state == .switching)
    }

    @Test func resettingClearsAStatusButNotACheckInFlight() throws {
        var refused = ServerSwitchFlow()
        _ = refused.submit(text: "todz.example.com", serverURL: try address(inUseText))
        refused.reset()
        #expect(refused.state == .idle)
        var inFlight = try checking()
        inFlight.reset()
        #expect(inFlight.state == .checking)
    }
}
