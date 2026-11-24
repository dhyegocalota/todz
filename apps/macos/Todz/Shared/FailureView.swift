import SwiftUI
import TodzKit

private let failureSymbol = "exclamationmark.triangle"

struct FailureView: View {
    let banner: AppBanner

    var body: some View {
        ContentUnavailableView {
            Label(banner.title, systemImage: failureSymbol)
        } description: {
            if let body = banner.body {
                Text(body)
            }
        } actions: {
            BannerActionButton()
        }
    }
}
