# @todz/core

The task and project rules the MCP server and the owner API share: what a valid task is, how a short id, a due date and a manual order work, what a history line records and which task is next. It reaches storage only through ports and does no I/O of its own, so every surface applies the same rules.
