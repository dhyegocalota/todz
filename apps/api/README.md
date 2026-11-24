# @todz/api

The Worker behind the MCP server and the owner API. A directory knows who owns which workspace and project and which credential opens which project; each project keeps its tasks and their history in a store of its own. A credential reaches a project only through the directory, so no read or write ever crosses a project boundary. It applies the shared task rules in a single transaction and answers expected failures with results.

The MCP server lets an agent in any MCP client read and change the tasks of one project with one key, shown once and kept only as a digest. It speaks both protocol eras, names the client behind every write, sees today in the owner's time zone, and answers in compact text with short task ids, never naming another project.

The owner signs in with a link sent to their email address: the link works once, for a few minutes, and only in the app that asked for it. A development Worker prints the message in its console instead of mailing it; a deployed one mails it from todz through Cloudflare, as a designed message with a plain-text twin, and welcomes an owner once, when the first sign-in creates them. The messages are written as React Email templates and rendered ahead of time, so the Worker carries only their output and serves the logo they show.

The owner API lets the person behind the agents sign in, keep their workspaces and projects, do everything to a task that an agent can, read a task's history, and issue and revoke the keys that agents use. Each project tells its owner what changed since their last pull and, while the app is open, says only that something changed. Another owner's workspace, project or key is indistinguishable from one that never existed.
