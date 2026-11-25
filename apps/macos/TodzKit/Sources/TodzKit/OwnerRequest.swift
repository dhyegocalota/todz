import Foundation

private let authorizationHeader = "Authorization"
private let bearerPrefix = "Bearer "
private let contentTypeHeader = "Content-Type"
private let jsonContentType = "application/json"
private let appVersionHeader = "Todz-App-Version"

struct OwnerRequest {
    let method: RequestMethod
    let path: String
    let session: String?
    let queryItems: [URLQueryItem]
    let body: Data?

    init(method: RequestMethod, path: String, session: String?, queryItems: [URLQueryItem] = [], body: (any Encodable)? = nil) throws {
        self.method = method
        self.path = path
        self.session = session
        self.queryItems = queryItems
        self.body = try body.map { try OwnerCoding.encoder().encode($0) }
    }

    func transportRequest(baseURL: URL, appVersion: String) -> URLRequest {
        let address = baseURL.appending(path: path)
        var request = URLRequest(url: queryItems.isEmpty ? address : address.appending(queryItems: queryItems))
        request.httpMethod = method.rawValue
        request.httpBody = body
        request.setValue(appVersion, forHTTPHeaderField: appVersionHeader)
        if let session { request.setValue(bearerPrefix + session, forHTTPHeaderField: authorizationHeader) }
        if body != nil { request.setValue(jsonContentType, forHTTPHeaderField: contentTypeHeader) }
        return request
    }
}
