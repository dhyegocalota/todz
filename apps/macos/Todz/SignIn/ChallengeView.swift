import SwiftUI
import TodzKit
import WebKit

private let challengePath = "/sign-in/challenge"
private let messageHandlerName = "turnstile"
private let challengeHeight: CGFloat = 65
private let noToken = ""

struct ChallengeView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        ChallengeWebView(model: model, round: model.challengeRound)
            .frame(height: challengeHeight)
    }
}

private struct ChallengeWebView: NSViewRepresentable {
    let model: AppModel
    let round: Int

    func makeCoordinator() -> ChallengeCoordinator {
        ChallengeCoordinator(model: model)
    }

    func makeNSView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .nonPersistent()
        configuration.userContentController.add(context.coordinator, name: messageHandlerName)
        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.setAccessibilityLabel(SignInCopy.challengeLabel)
        return webView
    }

    func updateNSView(_ webView: WKWebView, context: Context) {
        guard context.coordinator.loadedRound != round else { return }
        context.coordinator.loadedRound = round
        webView.load(URLRequest(url: AppConfiguration.baseURL.appending(path: challengePath)))
    }

    static func dismantleNSView(_ webView: WKWebView, coordinator: ChallengeCoordinator) {
        webView.configuration.userContentController.removeScriptMessageHandler(forName: messageHandlerName)
    }
}

@MainActor final class ChallengeCoordinator: NSObject, WKScriptMessageHandler, WKNavigationDelegate {
    var loadedRound: Int?
    private let model: AppModel

    init(model: AppModel) {
        self.model = model
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let token = message.body as? String else {
            model.acceptChallenge(token: noToken)
            return
        }
        model.acceptChallenge(token: token)
    }

    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping @MainActor (WKNavigationActionPolicy) -> Void
    ) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.cancel)
            return
        }
        let isAllowed = ChallengeNavigation.isAllowed(url: url, apiBaseURL: AppConfiguration.baseURL, isMainFrame: navigationAction.targetFrame?.isMainFrame == true)
        decisionHandler(isAllowed ? .allow : .cancel)
    }
}
