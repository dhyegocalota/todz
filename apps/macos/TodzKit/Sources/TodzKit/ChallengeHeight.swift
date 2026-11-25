import Foundation

private let widgetSelector = ".cf-turnstile"

public enum ChallengeHeight {
    public static let minimum = 65.0
    public static let maximum = 500.0
    public static let handlerName = "turnstileHeight"
    public static let observerScript = """
    (() => {
      const widget = document.querySelector('\(widgetSelector)');
      if (widget) new ResizeObserver(() => window.webkit.messageHandlers.\(handlerName).postMessage(widget.getBoundingClientRect().height)).observe(widget);
    })();
    """

    public static func clamped(reported: Double) -> Double? {
        guard reported.isFinite else { return nil }
        return min(max(reported, minimum), maximum)
    }
}
