# @todz/api

The Worker behind the MCP server and the owner API. A directory knows who owns which workspace and project and which credential opens which project; each project keeps its tasks and their history in a store of its own. A credential reaches a project only through the directory, so no read or write ever crosses a project boundary. It applies the shared task rules in a single transaction and answers expected failures with results.

The MCP server lets an agent in any MCP client read and change the tasks of one project with one key, shown once and kept only as a digest. It speaks both protocol eras, names the client behind every write, sees today in the owner's time zone, and answers in compact text with short task ids, never naming another project. When the owner turns it on, the next task comes with one line saying how many of the project's tasks are due today or overdue.

The owner signs in with a link sent to their email address: the link works once, for a few minutes, and only in the app that asked for it. A development Worker prints the message in its console instead of mailing it; a deployed one mails it from todz through Cloudflare, as a designed message with a plain-text twin, and welcomes an owner once, when the first sign-in creates them. The messages are written as React Email templates and rendered ahead of time, so the Worker carries only their output and serves the logo they show. Every public sign-in route is limited per client address, and both sign-in posts need a solved Cloudflare Turnstile check before they count against a per-address and a global limit, so neither one client nor many can flood the service or mail strangers; a missing piece closes sign-in instead of opening it. The app solves the check for a link request in a small page the Worker serves, and the page the mail opens solves it for the sign-in.

The owner API lets the person behind the agents sign in, keep their workspaces and projects, do everything to a task that an agent can, read a task's history, and issue and revoke the keys that agents use. Each project tells its owner what changed since their last pull and, while the app is open, says only that something changed. Another owner's workspace, project or key is indistinguishable from one that never existed.

The same Worker serves the todz website on its own host: one short page that says what todz is, with real screenshots of the app and a waitlist form, linking the self-host guide on the docs site; the guide's old address on either host sends visitors there. Every page's footer credits Logic Bit, the studio that built todz. Each host answers only its own pages, the www host sends visitors to the site, and any other host finds nothing.

The waitlist keeps each address once and mails it a short confirmation once, ever, and answers the same whether the address is new or already there. It is guarded like sign-in, by limits per client, per address and overall and by a Turnstile check, and it stays closed instead of open when any of those pieces is missing.

The site also holds a small admin for the one owner address: a link mailed to it works only in the browser that asked for it, once and briefly, and opens a short session that shows the waitlist and exports it. Every other address gets the same answer and no mail, and the admin is guarded and closes the same way.

Once a day the same owner address gets a short digest of the waitlist's last day: who joined, the total and any confirmation that failed. Without that address the digest goes nowhere.

On every host the Worker names its own origin at a public health address, so an app can check an address before it uses one.

The deployed Worker is production on its own domain, with its own database and the mail sender of todz; a development Worker overrides that configuration and keeps its state on this machine. The development database has a new name since the Worker was first deployed, so state from earlier local runs stays behind and can be deleted.
