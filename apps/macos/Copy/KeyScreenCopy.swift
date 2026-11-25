import Foundation
import TodzKit

enum KeyScreenCopy {
    static let title = "Connect an Agent"
    static let intro = "Any MCP client can read and change this project's tasks. Create a key, then copy your client's command."
    static let project = "Project"
    static let createKey = "Create a Key"
    static let createKeyNote = "A key lets an agent work this project. You'll see it once."
    static let creating = "Creating a key…"
    static let issueFailed = "The key wasn't created."
    static let offlineReason = "Keys need a connection to todz."
    static let secretTitle = "Copy it now. You won't see this key again."
    static let hideKey = "Hide Key"
    static let hideKeyHint = "The key keeps working; todz can't show it again."
    static let claudeCode = "Claude Code"
    static let codex = "Codex"
    static let cursor = "Cursor"
    static let claudeCodeCaption = AttributedString(
        localized: "Run it in your project's folder. To replace a key there, run `claude mcp remove todz` first."
    )
    static let codexConfigCaption = AttributedString(localized: "Add to ~/.codex/config.toml")
    static let codexShellCaption = AttributedString(localized: "Add to your shell profile")
    static let cursorCaption = AttributedString(localized: "Or add to mcp.json")
    static let addToCursor = "Add to Cursor"
    static let cursorDidNotOpen = "Cursor didn't open. Copy the JSON below instead."
    static let secretPlaceholder = "<new key>"
    static let copy = "Copy"
    static let copied = "Copied"
    static let createKeyFirst = "Create a key first."
    static let serverURL = "Server URL"
    static let serverURLCaption = AttributedString(localized: "The server in use. Change it in Settings › Server.")
    static let tools = "Tools"
    static let nextTool = "Returns the one task to do now, with its notes."
    static let addTool = "Adds one or many tasks."
    static let listTool = "Lists tasks by state, due date and text."
    static let updateTool = "Changes a task's title, notes, due date or order."
    static let doneTool = "Completes tasks, with a note of what was done."
    static let keys = "Keys"
    static let keysFooter = "Revoke a key here at any time; agents using it lose access at once."
    static let noKeys = "No keys yet. Agents can't reach this project until you create one."
    static let listFailed = "Couldn't load the keys."
    static let revoke = "Revoke…"
    static let revokeKey = "Revoke Key"
    static let revoking = "Revoking"
    static let revokeFailed = "This key wasn't revoked. It still works."
    static let claudeCodeCommand = "Claude Code command"
    static let codexConfiguration = "Codex configuration"
    static let codexShellLine = "Codex shell line"
    static let cursorJSON = "Cursor JSON"

    static func secretBody(hint: String) -> String {
        "The commands below carry the key ending in \(hint). It's hidden for good when you leave this screen."
    }

    static func maskedKey(hint: String) -> String {
        "todz_…\(hint)"
    }

    static func created(time: String) -> String {
        "Created \(time)"
    }

    static func revokeTitle(hint: String) -> String {
        "Revoke the key ending in \(hint)?"
    }

    static func revokeMessage(project: String) -> String {
        "Agents using it can no longer reach \(project). This can't be undone."
    }

    static func copyItem(item: String) -> String {
        "Copy \(item)"
    }

    static func keyEnding(hint: String) -> String {
        "Key ending in \(hint)"
    }

    static func revokeKeyLabel(hint: String) -> String {
        "Revoke the key ending in \(hint)"
    }

    static func failureBody(failure: KeyFailure) -> String {
        switch failure {
        case .unreachable: ErrorCopy.networkBody
        case .unexpected: ErrorCopy.serverBody
        }
    }

    static func clientName(client: AgentClient) -> String {
        switch client {
        case .claudeCode: claudeCode
        case .codex: codex
        case .cursor: cursor
        }
    }

    static func toolLine(tool: AgentTool) -> String {
        switch tool {
        case .next: nextTool
        case .add: addTool
        case .list: listTool
        case .update: updateTool
        case .done: doneTool
        }
    }
}
