import SwiftUI
import TodzKit

private let ringDiameter: CGFloat = 54
private let ringLineWidth: CGFloat = 6
private let ringStart = Angle.degrees(-90)
private let emptyProgress = 0.0

struct TodayRing: View {
    let content: WidgetContent

    var body: some View {
        switch content {
        case .prompt:
            WidgetPrompt(title: MainWindowCopy.today) { ring(progress: emptyProgress) }
        case let .empty(workspaceName):
            layout(progress: emptyProgress, caption: AttributedString(MainWindowCopy.todayEmptyTitle))
                .accessibilityLabel(AccessibilityCopy.todayIn(workspace: workspaceName))
                .accessibilityValue(MainWindowCopy.todayEmptyTitle)
        case let .today(today):
            let progress = WidgetCopy.progress(done: today.doneCount, total: today.totalCount)
            layout(progress: today.progress, caption: strongInPrimary(progress))
                .accessibilityLabel(AccessibilityCopy.todayIn(workspace: today.workspaceName))
                .accessibilityValue(String(progress.characters))
        }
    }

    private func layout(progress: Double, caption: AttributedString) -> some View {
        VStack(alignment: .leading) {
            HStack {
                WidgetBrandGlyph()
                Text(MainWindowCopy.today)
                    .font(.headline)
                    .unredacted()
            }
            Spacer()
            ring(progress: progress)
                .frame(maxWidth: .infinity)
            Spacer()
            Text(caption)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .todzCountTransition()
                .invalidatableContent()
                .frame(maxWidth: .infinity)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .accessibilityElement(children: .ignore)
    }

    private func ring(progress: Double) -> some View {
        ZStack {
            Circle()
                .stroke(.fill.tertiary, lineWidth: ringLineWidth)
            if progress > emptyProgress {
                Circle()
                    .trim(from: emptyProgress, to: progress)
                    .stroke(Color.accentColor, style: StrokeStyle(lineWidth: ringLineWidth, lineCap: .round))
                    .rotationEffect(ringStart)
                    .widgetAccentable()
            }
        }
        .frame(width: ringDiameter, height: ringDiameter)
        .invalidatableContent()
    }

    private func strongInPrimary(_ text: AttributedString) -> AttributedString {
        var styled = text
        let strongRanges = text.runs
            .filter { $0.inlinePresentationIntent?.contains(.stronglyEmphasized) == true }
            .map(\.range)
        strongRanges.forEach { styled[$0].foregroundColor = .primary }
        return styled
    }
}
