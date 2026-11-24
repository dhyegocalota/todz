import Foundation

private let snapshotFileName = "widget-snapshot.json"
private let requestsFolderName = "requests"
private let requestFileExtension = "json"
private let requestsPerPass = 50
private let snapshotMaxByteCount = 1_048_576
private let requestMaxByteCount = 4_096
private let readFlags = O_RDONLY | O_NOFOLLOW | O_NONBLOCK

private typealias DatedFile = (modifiedAt: Date, file: URL)

private func isOlder(_ lhs: DatedFile, _ rhs: DatedFile) -> Bool {
    (lhs.modifiedAt, lhs.file.lastPathComponent) < (rhs.modifiedAt, rhs.file.lastPathComponent)
}

// NB ADR 0032: the widgets read one snapshot and add one file per request, and a read refuses anything but a regular file.
public struct FileWidgetStore: WidgetStore {
    private let folder: URL

    public init(folder: URL) {
        self.folder = folder
    }

    private var snapshotFile: URL {
        folder.appending(path: snapshotFileName)
    }

    private var requestsFolder: URL {
        folder.appending(path: requestsFolderName)
    }

    private func requestFile(name: String) -> URL? {
        guard name.wholeMatch(of: /[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}\.json/) != nil else { return nil }
        return requestsFolder.appending(path: name)
    }

    public func readSnapshot() throws -> WidgetSnapshot? {
        try read(WidgetSnapshot.self, from: snapshotFile, maxByteCount: snapshotMaxByteCount)
    }

    public func writeSnapshot(_ snapshot: WidgetSnapshot) throws {
        try write(snapshot, to: snapshotFile)
    }

    public func eraseSnapshot() throws {
        try remove(snapshotFile)
    }

    public func addRequest(_ request: WidgetRequest) throws {
        let file = requestsFolder.appending(path: UUID().uuidString).appendingPathExtension(requestFileExtension)
        try write(request, to: file)
    }

    public func requests() throws -> [StoredWidgetRequest] {
        try oldestRequestFiles().compactMap(storedRequest)
    }

    public func removeRequests(_ names: [String]) throws {
        guard try hasRequestsFolder() else { return }
        try names.compactMap(requestFile).forEach(remove)
    }

    public func erase() throws {
        try remove(snapshotFile)
        try remove(requestsFolder)
    }

    private func hasRequestsFolder() throws -> Bool {
        switch FolderStatus.madePrivate(requestsFolder) {
        case .missing: false
        case .owned: true
        case .refused: throw WidgetStoreError.unreadable
        }
    }

    private func oldestRequestFiles() throws -> [URL] {
        guard try hasRequestsFolder() else { return [] }
        let listed: [URL]
        do {
            listed = try FileManager.default.contentsOfDirectory(
                at: requestsFolder,
                includingPropertiesForKeys: [.contentModificationDateKey],
                options: .skipsHiddenFiles
            )
        } catch CocoaError.fileReadNoSuchFile {
            return []
        } catch {
            throw WidgetStoreError.unreadable
        }
        let dated = listed
            .filter { requestFile(name: $0.lastPathComponent) != nil }
            .compactMap { file in modificationDate(of: file).map { (modifiedAt: $0, file: file) } }
        return dated.sorted(by: isOlder).prefix(requestsPerPass).map(\.file)
    }

    private func modificationDate(of file: URL) -> Date? {
        try? file.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate
    }

    private func storedRequest(in file: URL) -> StoredWidgetRequest? {
        do {
            guard let request = try read(WidgetRequest.self, from: file, maxByteCount: requestMaxByteCount) else { return nil }
            return StoredWidgetRequest(name: file.lastPathComponent, request: request)
        } catch {
            try? remove(file)
            return nil
        }
    }

    private func readData(from file: URL, maxByteCount: Int) throws -> Data? {
        let descriptor = open(file.path(percentEncoded: false), readFlags)
        guard descriptor >= 0 else {
            let isMissing = errno == ENOENT
            guard isMissing else { throw WidgetStoreError.unreadable }
            return nil
        }
        let handle = FileHandle(fileDescriptor: descriptor, closeOnDealloc: true)
        var status = stat()
        let isRegularFile = fstat(descriptor, &status) == 0 && status.st_mode & S_IFMT == S_IFREG
        let isWithinCap = status.st_size <= maxByteCount
        guard isRegularFile, isWithinCap else { throw WidgetStoreError.unreadable }
        do {
            guard let data = try handle.read(upToCount: maxByteCount + 1), data.count <= maxByteCount else { throw WidgetStoreError.unreadable }
            return data
        } catch {
            throw WidgetStoreError.unreadable
        }
    }

    private func read<Value: Decodable>(_ type: Value.Type, from file: URL, maxByteCount: Int) throws -> Value? {
        guard let data = try readData(from: file, maxByteCount: maxByteCount) else { return nil }
        do {
            return try OwnerCoding.decoder().decode(type, from: data)
        } catch {
            throw WidgetStoreError.unreadable
        }
    }

    private func write(_ value: some Encodable, to file: URL) throws {
        do {
            try PrivateFile.write(OwnerCoding.encoder().encode(value), to: file)
        } catch {
            throw WidgetStoreError.unwritable
        }
    }

    private func remove(_ item: URL) throws {
        do {
            try FileManager.default.removeItem(at: item)
        } catch CocoaError.fileNoSuchFile {
            return
        }
    }
}
