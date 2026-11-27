import SwiftUI
import TodzKit

struct SettingsLanguageRows: View {
    @Environment(LanguageModel.self) private var languageModel

    var body: some View {
        SettingsRow(title: SettingsCopy.language, detail: SettingsCopy.languageDetail) {
            Picker(SettingsCopy.language, selection: languageChoice) {
                ForEach(LanguageChoice.all, id: \.self) { choice in
                    Text(SettingsCopy.languageName(choice)).tag(choice)
                }
            }
            .pickerStyle(.menu)
            .labelsHidden()
        }
        SettingsRow(title: SettingsCopy.appearance, detail: SettingsCopy.appearanceDetail) {
            Picker(SettingsCopy.appearance, selection: appearanceChoice) {
                ForEach(AppearanceChoice.allCases, id: \.self) { choice in
                    Text(SettingsCopy.appearanceName(choice)).tag(choice)
                }
            }
            .pickerStyle(.menu)
            .labelsHidden()
        }
    }

    private var languageChoice: Binding<LanguageChoice> {
        Binding {
            languageModel.choice
        } set: { choice in
            languageModel.select(choice)
        }
    }

    private var appearanceChoice: Binding<AppearanceChoice> {
        Binding {
            languageModel.appearance
        } set: { choice in
            languageModel.select(choice)
        }
    }
}
