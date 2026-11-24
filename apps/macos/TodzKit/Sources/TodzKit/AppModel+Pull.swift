extension AppModel {
    public var isRefreshing: Bool {
        fatalError("AppModel.isRefreshing is not implemented")
    }

    @discardableResult
    func pullProject(identifier: String) async -> ProjectPull? {
        fatalError("AppModel.pullProject is not implemented")
    }

    @discardableResult
    func requestPull(projectIdentifier: String) -> Task<ProjectPull?, Never>? {
        fatalError("AppModel.requestPull is not implemented")
    }
}
