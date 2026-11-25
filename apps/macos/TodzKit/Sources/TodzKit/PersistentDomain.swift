import Foundation

struct PersistentDomain {
    let defaults: UserDefaults
    let name: String

    func value(forKey key: String) -> Any? {
        defaults.persistentDomain(forName: name)?[key]
    }

    func set(_ value: Any, forKey key: String) {
        defaults.set(value, forKey: key)
    }

    func day(forKey key: String) -> CalendarDate? {
        (value(forKey: key) as? String).flatMap(CalendarDate.init(text:))
    }
}
