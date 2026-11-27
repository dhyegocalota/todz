# 0121. Every erase at launch writes one breadcrumb line that names the path and never task data

- Status: Accepted (the loop's call)
- Date: 2026-11-27
- Deciders: Claude (the build loop's call, under the owner's v1.2 order of 2026-11-27: diagnose a launch that erased the cached account)
- Inspired by: [0035](0035-with-the-personal-team-the-widgets-share-the-app-group.md)

The loop's call: each path that erases the cached account at launch (an owner cache that fails to decode, the erase of another server's data, an owner mismatch when the cache is opened) writes one line to the unified log (category `launch`) and to a small rotating breadcrumb file in the App Group, holding a timestamp, the path and the reason, never task data, names or emails. A later launch that finds an empty cache can then say which path emptied it. The alternatives were the unified log alone (it is gone after a short time and cannot be read after the fact by the owner) and a full cache snapshot before erasing (it would keep the very data an erase is meant to remove).
