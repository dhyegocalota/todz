extension AppModel {
    public func loadOwnerKeys() async {
        let isListShown = ownerKeys?.isLoaded == true
        if !isListShown { ownerKeys = .loading }
        do {
            ownerKeys = .loaded(try await request { try await service.listOwnerKeys(session: $0) })
        } catch {
            guard !isListShown else { return }
            ownerKeys = .failed(KeyFailure(error))
        }
    }

    public func issueOwnerKey() async {
        guard !isChangingOwnerKeys else { return }
        isChangingOwnerKeys = true
        defer { isChangingOwnerKeys = false }
        ownerKeyFailure = nil
        do {
            issuedOwnerKey = try await request { try await service.issueOwnerKey(session: $0) }
        } catch {
            ownerKeyFailure = OwnerKeyFailure(creating: error)
        }
        await loadOwnerKeys()
    }

    public func revokeOwnerKey(_ key: ProjectKey) async {
        guard !isChangingOwnerKeys else { return }
        isChangingOwnerKeys = true
        defer { isChangingOwnerKeys = false }
        ownerKeyFailure = nil
        do {
            try await request { try await service.revokeOwnerKey(session: $0, keyIdentifier: key.identifier) }
        } catch OwnerAPIError.notFound {
        } catch {
            ownerKeyFailure = .notRevoked
            return
        }
        if issuedOwnerKey?.key.identifier == key.identifier { issuedOwnerKey = nil }
        await loadOwnerKeys()
    }

    public func hideOwnerKey() {
        issuedOwnerKey = nil
    }

    public func forgetOwnerKeys() {
        ownerKeys = nil
        issuedOwnerKey = nil
        isChangingOwnerKeys = false
        ownerKeyFailure = nil
    }
}
