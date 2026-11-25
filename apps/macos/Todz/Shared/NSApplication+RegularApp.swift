import AppKit

extension NSApplication {
    // NB ADR 0074: opening a window turns todz regular before it activates, since a hidden app's window never becomes key on its own.
    func activateAsRegularApp() {
        setActivationPolicy(.regular)
        activate()
    }
}
