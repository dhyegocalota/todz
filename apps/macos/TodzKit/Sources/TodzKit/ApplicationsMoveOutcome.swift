import Foundation

public enum ApplicationsMoveRefusal: Error, Equatable, Sendable {
    case unresolvedPath
    case alreadyInPlace
    case destinationOccupied
    case originalUnknown
    case otherTodzRunning
    case stagingNotCleared
    case copyFailed
    case signatureMismatch
    case quarantineNotStripped
    case installFailed
    case rollbackFailed
}

public enum ApplicationsMoveOutcome: Equatable, Sendable {
    case moved(destination: URL)
    case movedLeavingOriginal(destination: URL)
    case refused(ApplicationsMoveRefusal)
}
