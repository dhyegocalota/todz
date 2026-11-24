import SwiftUI
import TodzKit

private let bannerSymbol = "exclamationmark.triangle.fill"

struct ErrorBanner: View {
    let banner: AppBanner

    var body: some View {
        HStack {
            Image(systemName: bannerSymbol)
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

    private func announce() {
        AccessibilityNotification.Announcement(banner.title).post()
    }
}
