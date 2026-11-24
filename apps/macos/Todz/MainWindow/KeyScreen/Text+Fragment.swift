import SwiftUI

extension Text {
    init(_ text: String, marking fragment: String, with mark: (Text) -> Text) {
        let pieces = text.components(separatedBy: fragment)
        self = pieces.dropFirst().reduce(Text(pieces[0])) { joined, piece in
            joined + mark(Text(fragment)) + Text(piece)
        }
    }
}
