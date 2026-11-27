import Foundation
import os

enum StubAnswer: Sendable {
    case response(status: Int, body: String)
    case responseWithHeaders(status: Int, body: String, headers: [String: String])
    case failure(URLError)
}

struct StubState: Sendable {
    var answer: StubAnswer?
    var requests: [RecordedRequest] = []
}

struct RecordedRequest: Sendable {
    let method: String?
    let path: String?
    let query: String?
    let authorization: String?
    let contentType: String?
    let appVersion: String?
    let acceptLanguage: String?
    let body: Data
}

private let streamChunkSize = 4_096

private func bodyOf(_ request: URLRequest) -> Data {
    guard let stream = request.httpBodyStream else { return Data() }
    stream.open()
    defer { stream.close() }
    var body = Data()
    var chunk = [UInt8](repeating: 0, count: streamChunkSize)
    while stream.hasBytesAvailable {
        let count = stream.read(&chunk, maxLength: streamChunkSize)
        guard count > 0 else { return body }
        body.append(chunk, count: count)
    }
    return body
}

final class StubURLProtocol: URLProtocol {
    static let state = OSAllocatedUnfairLock(initialState: StubState())

    static func session(answering answer: StubAnswer) -> URLSession {
        state.withLock { $0 = StubState(answer: answer) }
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [StubURLProtocol.self]
        return URLSession(configuration: configuration)
    }

    static func recordedRequests() -> [RecordedRequest] {
        state.withLock { $0.requests }
    }

    override class func canInit(with request: URLRequest) -> Bool { true }

    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        let recorded = RecordedRequest(
            method: request.httpMethod,
            path: request.url?.path(),
            query: request.url?.query(),
            authorization: request.value(forHTTPHeaderField: "Authorization"),
            contentType: request.value(forHTTPHeaderField: "Content-Type"),
            appVersion: request.value(forHTTPHeaderField: "Todz-App-Version"),
            acceptLanguage: request.value(forHTTPHeaderField: "Accept-Language"),
            body: bodyOf(request)
        )
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
            respond(url: url, status: status, body: body, headers: [:])
        case let .responseWithHeaders(status, body, headers):
            respond(url: url, status: status, body: body, headers: headers)
        }
    }

    private func respond(url: URL, status: Int, body: String, headers: [String: String]) {
        guard let response = HTTPURLResponse(url: url, statusCode: status, httpVersion: nil, headerFields: headers) else { return }
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: Data(body.utf8))
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}
}
