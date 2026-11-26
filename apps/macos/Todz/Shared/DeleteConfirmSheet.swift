import SwiftUI
import TodzKit

private let sheetWidth: CGFloat = 320

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
                .font(.headline)
            Text(kind.message)
                .fixedSize(horizontal: false, vertical: true)
            Text(SheetCopy.typeNamePrompt(name: kind.name))
            TextField(SheetCopy.nameLabel, text: $typedName)
                .textFieldStyle(.roundedBorder)
                .focused($isNameFocused)
                .disabled(isDeleting)
                .onSubmit(submit)
            if let failure {
                Text(failure.title)
                    .foregroundStyle(.red)
            }
            HStack {
                Spacer()
                Button(SheetCopy.cancel, role: .cancel) { dismiss() }
                    .keyboardShortcut(.cancelAction)
                if isDeleting {
                    ProgressView()
                        .controlSize(.small)
                }
                if !isDeleting {
                    Button(SheetCopy.delete, role: .destructive, action: submit)
                        .disabled(!isConfirmed)
                }
            }
        }
        .padding()
        .frame(width: sheetWidth)
        .task { isNameFocused = true }
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
