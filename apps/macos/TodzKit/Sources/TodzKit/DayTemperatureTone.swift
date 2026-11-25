public enum DayTemperatureTone {
    // NB ADR 0065: the tone is shown only with the setting on and no Focus holding todz, in the menu bar and in the snapshot alike.
    public static func isShown(isSettingOn: Bool, isQuiet: Bool) -> Bool {
        isSettingOn && !isQuiet
    }
}
