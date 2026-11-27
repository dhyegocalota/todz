import Foundation
import TodzKit

enum KeyScreenCopy {
    static var title: String { Localized.text("Connect an Agent") }
    static var intro: String { Localized.text("Add todz to any MCP client with one command. The client opens your browser, where you sign in and pick a project.") }
    static let claudeCode = "Claude Code"
    static let codex = "Codex"
    static let cursor = "Cursor"
    static var claudeCodeCaption: AttributedString { Localized.attributed("Run it in your project's folder, then run `/mcp` and choose todz to sign in.") }
    static var codexConfigCaption: AttributedString { Localized.attributed("Add to ~/.codex/config.toml") }
    static var codexLoginCaption: AttributedString { Localized.attributed("Then sign in") }
    static var cursorCaption: AttributedString { Localized.attributed("Or add to mcp.json") }
    static var addToCursor: String { Localized.text("Add to Cursor") }
    static var cursorDidNotOpen: String { Localized.text("Cursor didn't open. Copy the JSON below instead.") }
    static var copy: String { Localized.text("Copy") }
    static var copied: String { Localized.text("Copied") }
    static var serverURL: String { Localized.text("Server URL") }
    static var serverURLCaption: AttributedString { Localized.attributed("The server in use. Change it in Settings › Server.") }
    static var tools: String { Localized.text("Tools") }
    static var nextTool: String { Localized.text("Returns the one task to do now, with its notes.") }
    static var addTool: String { Localized.text("Adds one or many tasks.") }
    static var listTool: String { Localized.text("Lists tasks by state, due date and text.") }
    static var updateTool: String { Localized.text("Changes a task's title, notes, due date or order.") }
    static var doneTool: String { Localized.text("Completes tasks, with a note of what was done.") }
    static var listFailed: String { Localized.text("Couldn't load the connected apps.") }
    static var readTheGuide: String { Localized.text("Read the guide to connecting an agent") }
    static var claudeCodeCommand: String { Localized.text("Claude Code command") }
    static var codexConfiguration: String { Localized.text("Codex configuration") }
    static var codexLoginLine: String { Localized.text("Codex login command") }
    static var cursorJSON: String { Localized.text("Cursor JSON") }

    static func copyItem(item: String) -> String {
        Localized.text("Copy \(item)")
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
