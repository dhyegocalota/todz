import Foundation

extension AppModel {
    public func loadOwnerKeys() async {
        let visit = ownerKeyVisit
        let isListShown = ownerKeys?.isLoaded == true
        if !isListShown { ownerKeys = .loading }
        do {
            let keys = try await request { try await service.listOwnerKeys(session: $0) }
            guard ownerKeyVisit == visit else { return }
            ownerKeys = .loaded(keys)
        } catch {
            guard ownerKeyVisit == visit, !isListShown else { return }
            ownerKeys = .failed(KeyFailure(error))
        }
    }

    public func issueOwnerKey() async {
        guard !isChangingOwnerKeys else { return }
        let visit = ownerKeyVisit
        isChangingOwnerKeys = true
        defer { isChangingOwnerKeys = false }
        ownerKeyFailure = nil
        do {
            let issued = try await request { try await service.issueOwnerKey(session: $0) }
            guard ownerKeyVisit == visit else { return }
            issuedOwnerKey = issued
        } catch {
            guard ownerKeyVisit == visit else { return }
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
        ownerKeyVisit = UUID()
        ownerKeys = nil
        issuedOwnerKey = nil
        ownerKeyFailure = nil
    }
}
