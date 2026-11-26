import Foundation

public enum ApplicationsMoveRefusal: Error, Equatable, Sendable {
    case unresolvedPath
    case alreadyInPlace
    case otherTodzRunning
    case destinationRunning
    case previousCopyNotTrashed
    case copyFailed
    case signatureMismatch
    case quarantineNotStripped
    case rollbackFailed
}

public enum ApplicationsMoveOutcome: Equatable, Sendable {
    case moved(destination: URL)
    case movedLeavingOriginal(destination: URL)
    case refused(ApplicationsMoveRefusal)
}
