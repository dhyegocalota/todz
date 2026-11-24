// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "TodzKit",
    platforms: [.macOS(.v14)],
    products: [
        .library(name: "TodzKit", targets: ["TodzKit"]),
    ],
    targets: [
        .target(name: "TodzKit"),
        .testTarget(name: "TodzKitTests", dependencies: ["TodzKit"]),
    ]
)
