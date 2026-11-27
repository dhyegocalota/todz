import SwiftUI
import TodzKit

private let copySymbol = "doc.on.doc"
private let copiedSymbol = "checkmark"
private let copiedDuration: Duration = .seconds(2)
private let shownOpacity: Double = 1
private let hiddenOpacity: Double = 0

struct CopyButton: View {
    let text: String
    let item: String
    @State private var copyCount = 0
    @State private var isCopied = false

    var body: some View {
        Button(action: copy) {
            ZStack {
                Label(KeyScreenCopy.copy, systemImage: copySymbol)
                    .opacity(isCopied ? hiddenOpacity : shownOpacity)
                Label(KeyScreenCopy.copied, systemImage: copiedSymbol)
                    .opacity(isCopied ? shownOpacity : hiddenOpacity)
            }
        }
        .todzMotion(.busySwap, value: isCopied)
        .accessibilityLabel(KeyScreenCopy.copyItem(item: item))
        .task(id: copyCount) { await endCopied() }
    }

    private func copy() {
        Pasteboard.copy(text: text)
        isCopied = true
        copyCount += 1
        AccessibilityNotification.Announcement(KeyScreenCopy.copied).post()
    }

    private func endCopied() async {
        guard isCopied else { return }
        do {
            try await Task.sleep(for: copiedDuration)
        } catch {
            return
        }
        isCopied = false
    }
}
