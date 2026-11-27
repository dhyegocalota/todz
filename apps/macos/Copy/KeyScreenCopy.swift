import Foundation
import TodzKit

enum KeyScreenCopy {
    static let title = "Connect an Agent"
    static let intro = "Add todz to any MCP client with one command. The client opens your browser, where you sign in and pick a project."
    static let claudeCode = "Claude Code"
    static let codex = "Codex"
    static let cursor = "Cursor"
    static let claudeCodeCaption = AttributedString(localized: "Run it in your project's folder, then run `/mcp` and choose todz to sign in.")
    static let codexConfigCaption = AttributedString(localized: "Add to ~/.codex/config.toml")
    static let codexLoginCaption = AttributedString(localized: "Then sign in")
    static let cursorCaption = AttributedString(localized: "Or add to mcp.json")
    static let addToCursor = "Add to Cursor"
    static let cursorDidNotOpen = "Cursor didn't open. Copy the JSON below instead."
    static let copy = "Copy"
    static let copied = "Copied"
    static let serverURL = "Server URL"
    static let serverURLCaption = AttributedString(localized: "The server in use. Change it in Settings › Server.")
    static let tools = "Tools"
    static let nextTool = "Returns the one task to do now, with its notes."
    static let addTool = "Adds one or many tasks."
    static let listTool = "Lists tasks by state, due date and text."
    static let updateTool = "Changes a task's title, notes, due date or order."
    static let doneTool = "Completes tasks, with a note of what was done."
    static let listFailed = "Couldn't load the connected apps."
    static let readTheGuide = "Read the guide to connecting an agent"
    static let claudeCodeCommand = "Claude Code command"
    static let codexConfiguration = "Codex configuration"
    static let codexLoginLine = "Codex login command"
    static let cursorJSON = "Cursor JSON"

    static func copyItem(item: String) -> String {
        "Copy \(item)"
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
