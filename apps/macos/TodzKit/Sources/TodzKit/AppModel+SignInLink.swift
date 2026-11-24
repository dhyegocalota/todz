extension AppModel {
    public func loadSignInMethod() async {}

    public func requestSignInLink(email: String) async {}

    public func redeem(signInLink: SignInLink) async {}

    public func discardPendingLink() {}
}
