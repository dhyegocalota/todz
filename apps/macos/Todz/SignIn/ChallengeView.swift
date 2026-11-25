import SwiftUI
import TodzKit
import WebKit

private let messageHandlerName = "turnstile"
private let noToken = ""

struct ChallengeView: View {
    @Environment(AppModel.self) private var model
    @State private var height = ChallengeHeight.minimum

    var body: some View {
        ChallengeWebView(model: model, height: $height)
            .id(model.challengeRound)
            .frame(height: height)
    }
}

private final class FixedWebView: WKWebView {
    override func scrollWheel(with event: NSEvent) {
        nextResponder?.scrollWheel(with: event)
    }

    override func layout() {
        super.layout()
        descendants.compactMap { $0 as? NSScrollView }.forEach { scrollView in
            scrollView.hasVerticalScroller = false
            scrollView.hasHorizontalScroller = false
        }
    }
}

private extension NSView {
    var descendants: [NSView] {
        subviews.flatMap { [$0] + $0.descendants }
    }
}

private struct ChallengeWebView: NSViewRepresentable {
    let model: AppModel
    @Binding var height: Double

    func makeCoordinator() -> ChallengeCoordinator {
        ChallengeCoordinator(model: model, height: $height)
    }

    func makeNSView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .nonPersistent()
        configuration.userContentController.add(context.coordinator, name: messageHandlerName)
        configuration.userContentController.add(context.coordinator, name: ChallengeHeight.handlerName)
        configuration.userContentController.addUserScript(
            WKUserScript(source: ChallengeHeight.observerScript, injectionTime: .atDocumentEnd, forMainFrameOnly: true)
        )
        let webView = FixedWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.setAccessibilityLabel(SignInCopy.challengeLabel)
        webView.load(URLRequest(url: ChallengeNavigation.pageURL(apiBaseURL: model.serverURL.url)))
        return webView
    }

    func updateNSView(_ webView: WKWebView, context: Context) {}

    static func dismantleNSView(_ webView: WKWebView, coordinator: ChallengeCoordinator) {
        webView.configuration.userContentController.removeScriptMessageHandler(forName: messageHandlerName)
        webView.configuration.userContentController.removeScriptMessageHandler(forName: ChallengeHeight.handlerName)
    }
}

@MainActor final class ChallengeCoordinator: NSObject, WKScriptMessageHandler, WKNavigationDelegate {
    private let model: AppModel
    private let height: Binding<Double>

    init(model: AppModel, height: Binding<Double>) {
        self.model = model
        self.height = height
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        let origin = message.frameInfo.securityOrigin
        let isTrusted = ChallengeNavigation.isTrustedMessage(
            isMainFrame: message.frameInfo.isMainFrame,
            scheme: origin.protocol,
            host: origin.host,
            port: origin.port,
            apiBaseURL: model.serverURL.url
        )
        guard isTrusted else { return }
        guard message.name != ChallengeHeight.handlerName else {
            reportHeight(message.body)
            return
        }
        guard let token = message.body as? String else {
            model.acceptChallenge(token: noToken)
            return
        }
        model.acceptChallenge(token: token)
    }

    private func reportHeight(_ body: Any) {
        guard let reported = body as? Double else { return }
        height.wrappedValue = ChallengeHeight.clamped(reported: reported)
    }

    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping @MainActor (WKNavigationActionPolicy) -> Void
    ) {
        guard let url = navigationAction.request.url, let targetFrame = navigationAction.targetFrame else {
            decisionHandler(.cancel)
            return
        }
        let isAllowed = ChallengeNavigation.isAllowed(url: url, apiBaseURL: model.serverURL.url, isMainFrame: targetFrame.isMainFrame)
        decisionHandler(isAllowed ? .allow : .cancel)
    }
}
