import SwiftUI

struct KeyScreenFailureLine: View {
    let text: String

    var body: some View {
        Text(text)
            .foregroundStyle(.red)
            .onAppear(perform: announce)
    }

    private func announce() {
        AccessibilityNotification.Announcement(text).post()
    }
}
