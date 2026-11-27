export enum GrantDeletionReason {
  ReplayedCode = 'replayed_code',
  Eviction = 'eviction',
  ReuseAfterRotation = 'reuse_after_rotation',
  Cap = 'cap',
  ClientRevoke = 'client_revoke',
  SettingsDisconnect = 'settings_disconnect',
  Cascade = 'cascade',
}
