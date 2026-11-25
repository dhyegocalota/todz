import SwiftUI
import TodzKit

private let bannerSymbol = "exclamationmark.triangle.fill"
private let updateNeededSymbol = "arrow.down.circle"

struct ErrorBanner: View {
    let banner: AppBanner

    var body: some View {
        HStack {
            Image(systemName: symbol)
                .foregroundStyle(.secondary)
                .accessibilityHidden(true)
            VStack(alignment: .leading) {
                Text(banner.title)
                if let body = banner.body {
                    Text(body)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }
            Spacer()
            BannerActionButton()
        }
        .padding()
        .background(.fill.quaternary)
        .accessibilityElement(children: .contain)
        .onAppear(perform: announce)
        .onChange(of: banner) { announce() }
    }

    private var symbol: String {
        banner == .updateNeeded ? updateNeededSymbol : bannerSymbol
    }

    private func announce() {
        AccessibilityNotification.Announcement(banner.title).post()
    }
}
