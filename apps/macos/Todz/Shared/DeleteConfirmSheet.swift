import SwiftUI
import TodzKit

struct DeleteConfirmSheet: View {
    let kind: DeletionKind
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var typedName = ""
    @State private var failure: AppBanner?
    @FocusState private var isNameFocused: Bool

    var body: some View {
        VStack(alignment: .leading) {
            Text(kind.title)
                .font(.title3)
                .bold()
            Text(kind.message)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
            FormField(label: SheetCopy.typeNamePrompt(name: kind.name), prompt: SheetCopy.nameLabel, text: $typedName, issue: nil, isLabelShown: true, isBusy: isDeleting, isFocused: $isNameFocused)
                .onSubmit(submit)
            if let failure {
                ValidationLine(text: failure.title, tone: .issue)
            }
            HStack {
                Spacer()
                FormButton(title: SheetCopy.cancel, busyTitle: nil, kind: .cancel, isBusy: false, disabledReason: nil) { dismiss() }
                    .keyboardShortcut(.cancelAction)
                FormButton(title: SheetCopy.delete, busyTitle: SheetCopy.deleting, kind: .destructive, isBusy: isDeleting, disabledReason: mismatchReason, action: submit)
            }
        }
        .padding()
        .frame(minWidth: FormMetrics.sheetMinimumWidth)
        .task { isNameFocused = true }
    }

    private var mismatchReason: String? {
        guard !isConfirmed else { return nil }
        return SheetCopy.deleteMismatch
    }

    private var isDeleting: Bool {
        model.writesInFlight.contains(kind.target)
    }

    private var isConfirmed: Bool {
        NameConfirmation.isConfirmed(typed: typedName, name: kind.name)
    }

    private func submit() {
        guard isConfirmed, !isDeleting else { return }
        failure = nil
        Task {
            await kind.delete(in: model)
            guard !kind.isListed(in: model) else {
                failure = model.banner
                model.dismissBanner()
                return
            }
            dismiss()
        }
    }
}
