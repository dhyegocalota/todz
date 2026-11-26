import Foundation

private let hostedRunnerVariable = "GITHUB_ACTIONS"
private let hostedRunnerValue = "true"

let isOnHostedRunner = ProcessInfo.processInfo.environment[hostedRunnerVariable] == hostedRunnerValue
