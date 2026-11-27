import SwiftUI

private let allDoneSymbol = "checkmark.circle.fill"

struct MenuBarAllDone: View {
    var body: some View {
        HStack {
            Image(systemName: allDoneSymbol)
                .font(.title2)
                .foregroundStyle(Color.accentColor)
                .accessibilityHidden(true)
            VStack(alignment: .leading) {
                Text(MenuBarCopy.allDoneTitle)
                    .font(.headline)
                Text(MenuBarCopy.dayClosedBody)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            Spacer()
        }
        .padding()
        .background(.fill.quaternary, in: RoundedRectangle(cornerRadius: FormMetrics.fieldCornerRadius, style: .continuous))
        .padding(.horizontal)
        .padding(.bottom)
        .accessibilityElement(children: .combine)
    }
}
