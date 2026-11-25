import Foundation
import os
import Testing
@testable import TodzKit

private let baseText = "http://todz.test"
private let todzBody = "{\"service\":\"todz\",\"origin\":\"https://x.example.com\"}"
private let redirectedLocation = "https://elsewhere.example.com/health"
private let oversizedTodzBody = "{\"service\":\"todz\",\"origin\":\"https://x.example.com\"" + String(repeating: " ", count: 5_000) + "}"
private let shortDeadline: TimeInterval = 1
private let dripInterval: TimeInterval = 0.1
private let dripCount = 40
private let dripChunk = Data(" ".utf8)

private enum HealthStubAnswer: Sendable {
    case response(status: Int, body: String)
    case redirect(location: String)
    case failure(URLError)
    case drip
}

private struct HealthStubState: Sendable {
    var answer: HealthStubAnswer?
    var requests: [URLRequest] = []
}

private final class HealthStubProtocol: URLProtocol {
    static let state = OSAllocatedUnfairLock(initialState: HealthStubState())
    private var dripsLeft = dripCount

    static func session(answering answer: HealthStubAnswer, deadline: TimeInterval = ServerTiming.probeSeconds) -> URLSession {
        state.withLock { $0 = HealthStubState(answer: answer) }
        let configuration = OwnerAPI.probeConfiguration(deadline: deadline)
        configuration.protocolClasses = [HealthStubProtocol.self]
        return URLSession(configuration: configuration)
    }

    override class func canInit(with request: URLRequest) -> Bool { true }

    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        let recorded = request
        let answer = Self.state.withLock { state in
            state.requests.append(recorded)
            return state.answer
        }
        guard let answer, let url = request.url else {
            client?.urlProtocol(self, didFailWithError: URLError(.badServerResponse))
            return
        }
        switch answer {
        case let .failure(failure):
            client?.urlProtocol(self, didFailWithError: failure)
        case let .response(status, body):
            respond(url: url, status: status, body: body, headers: nil)
        case let .redirect(location):
            redirect(url: url, location: location)
        case .drip:
            startDripping(url: url)
        }
    }

    override func stopLoading() {
        NSObject.cancelPreviousPerformRequests(withTarget: self)
    }

    private func startDripping(url: URL) {
        guard let response = HTTPURLResponse(url: url, statusCode: 200, httpVersion: nil, headerFields: nil) else { return }
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        perform(#selector(dripOnce), with: nil, afterDelay: dripInterval)
    }

    @objc private func dripOnce() {
        guard dripsLeft > 0 else {
            client?.urlProtocolDidFinishLoading(self)
            return
        }
        dripsLeft -= 1
        client?.urlProtocol(self, didLoad: dripChunk)
        perform(#selector(dripOnce), with: nil, afterDelay: dripInterval)
    }

    private func respond(url: URL, status: Int, body: String, headers: [String: String]?) {
        guard let response = HTTPURLResponse(url: url, statusCode: status, httpVersion: nil, headerFields: headers) else { return }
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: Data(body.utf8))
        client?.urlProtocolDidFinishLoading(self)
    }

    private func redirect(url: URL, location: String) {
        guard let target = URL(string: location) else { return }
        guard let response = HTTPURLResponse(url: url, statusCode: 301, httpVersion: nil, headerFields: ["Location": location]) else { return }
        client?.urlProtocol(self, wasRedirectedTo: URLRequest(url: target), redirectResponse: response)
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocolDidFinishLoading(self)
    }
}

private func healthAPI(answering answer: HealthStubAnswer, deadline: TimeInterval = ServerTiming.probeSeconds) throws -> OwnerAPI {
    let baseURL = try #require(URL(string: baseText))
    return OwnerAPI(baseURL: baseURL, transport: HealthStubProtocol.session(answering: answer, deadline: deadline))
}

private func recordedRequests() -> [URLRequest] {
    HealthStubProtocol.state.withLock { $0.requests }
}

@Suite(.serialized) struct OwnerAPIHealthTests {
    @Test func aTodzAnswerNamesItsOriginAndSendsNoSession() async throws {
        let answer = try await healthAPI(answering: .response(status: 200, body: todzBody)).health()
        #expect(answer == .todz(origin: "https://x.example.com"))
        let request = try #require(recordedRequests().first)
        #expect(recordedRequests().count == 1)
        #expect(request.httpMethod == "GET")
        #expect(request.url?.path() == "/health")
        #expect(request.value(forHTTPHeaderField: "Authorization") == nil)
    }

    @Test(arguments: [
        (200, "{\"service\":\"other\",\"origin\":\"https://x.example.com\"}"),
        (200, "<html>hello</html>"),
        (200, "{\"service\":\"todz\"}"),
        (404, ""),
        (429, ""),
        (503, ""),
    ])
    func anythingElseIsNotTodz(status: Int, body: String) async throws {
        let answer = try await healthAPI(answering: .response(status: status, body: body)).health()
        #expect(answer == .notTodz)
    }

    @Test func aRedirectIsNotFollowedAndIsNotTodz() async throws {
        let answer = try await healthAPI(answering: .redirect(location: redirectedLocation)).health()
        #expect(answer == .notTodz)
        #expect(recordedRequests().count == 1)
    }

    @Test func aTransportFailureIsUnreachable() async throws {
        let api = try healthAPI(answering: .failure(URLError(.cannotConnectToHost)))
        await #expect(throws: OwnerAPIError.unreachable) { try await api.health() }
    }

    @Test func theRequestGivesUpAfterTheProbeTimeout() async throws {
        _ = try await healthAPI(answering: .response(status: 200, body: todzBody)).health()
        let request = try #require(recordedRequests().first)
        #expect(request.timeoutInterval == ServerTiming.probeSeconds)
    }

    @Test func probingMapsATransportFailureToUnreachable() async throws {
        let typed = try ServerAddress.checked(text: "https://x.example.com").get()
        let outcome = try await healthAPI(answering: .failure(URLError(.timedOut))).probe(typedAddress: typed)
        #expect(outcome == .unreachable)
    }

    @Test func theProbeTransportIsOneSessionThatGivesUpAfterTheProbeTimeoutInTotal() {
        #expect(OwnerAPI.probeTransport === OwnerAPI.probeTransport)
        #expect(OwnerAPI.probeTransport.configuration.timeoutIntervalForResource == ServerTiming.probeSeconds)
        #expect(OwnerAPI.probeTransport.configuration.urlCache == nil)
    }

    @Test func aServerThatDripsItsAnswerPastTheDeadlineIsUnreachable() async throws {
        let typed = try ServerAddress.checked(text: "https://x.example.com").get()
        let outcome = try await healthAPI(answering: .drip, deadline: shortDeadline).probe(typedAddress: typed)
        #expect(outcome == .unreachable)
    }

    @Test func anAnswerLongerThanTheHealthLimitIsNotTodz() async throws {
        let answer = try await healthAPI(answering: .response(status: 200, body: oversizedTodzBody)).health()
        #expect(answer == .notTodz)
    }

    @Test func probingAnAnswerThatNamesTheTypedOriginMatches() async throws {
        let typed = try ServerAddress.checked(text: "https://x.example.com").get()
        let outcome = try await healthAPI(answering: .response(status: 200, body: todzBody)).probe(typedAddress: typed)
        #expect(outcome == .matches)
    }
}
