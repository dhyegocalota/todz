import SwiftUI

struct SettingsRow<Control: View>: View {
    let title: String
    let detail: String
    @ViewBuilder let control: () -> Control

    var body: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading) {
                Text(title)
                Text(detail)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
            control()
        }
    }
}
