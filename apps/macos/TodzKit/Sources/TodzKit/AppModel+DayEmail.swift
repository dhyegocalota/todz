extension AppModel {
    public var canChangeDayEmail: Bool {
        fatalError("AppModel.canChangeDayEmail is not implemented")
    }

    public var dayEmailNotice: OwnerSettingNotice {
        fatalError("AppModel.dayEmailNotice is not implemented")
    }

    public func changeDayEmail(isEnabled: Bool) async {
        fatalError("AppModel.changeDayEmail(isEnabled:) is not implemented")
    }

    public func changeDayEmail(minutes: Int) async {
        fatalError("AppModel.changeDayEmail(minutes:) is not implemented")
    }

    public func forgetDayEmailFailure() {
        fatalError("AppModel.forgetDayEmailFailure is not implemented")
    }
}
