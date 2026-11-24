import Foundation

private let draftFilePrefix = ".draft-"
private let privateFileMode: mode_t = 0o600
private let privateFolderMode = 0o700
private let draftFlags = O_WRONLY | O_CREAT | O_EXCL

enum PrivateFile {
    static func write(_ data: Data, to file: URL) throws {
        let folder = file.deletingLastPathComponent()
        let attributes: [FileAttributeKey: Any] = [.posixPermissions: privateFolderMode]
        do {
            try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true, attributes: attributes)
        } catch {
            throw PrivateFileError.unwritable
        }
        let draftFile = folder.appending(path: draftFilePrefix + UUID().uuidString)
        let draftPath = draftFile.path(percentEncoded: false)
        let descriptor = open(draftPath, draftFlags, privateFileMode)
        guard descriptor >= 0 else { throw PrivateFileError.unwritable }
        defer { unlink(draftPath) }
        let draft = FileHandle(fileDescriptor: descriptor, closeOnDealloc: true)
        do {
            try draft.write(contentsOf: data)
            try draft.synchronize()
            try draft.close()
        } catch {
            throw PrivateFileError.unwritable
        }
        try excludeFromBackup(draftFile)
        guard rename(draftPath, file.path(percentEncoded: false)) == 0 else { throw PrivateFileError.unwritable }
    }

    private static func excludeFromBackup(_ draftFile: URL) throws {
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        var file = draftFile
        do {
            try file.setResourceValues(values)
        } catch {
            throw PrivateFileError.unwritable
        }
    }
}
