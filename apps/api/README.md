# @todz/api

The Worker behind the MCP server and the owner API. A directory knows who owns which workspace and project and which credential opens which project; each project keeps its tasks and their history in a store of its own. A credential reaches a project only through the directory, so no read or write ever crosses a project boundary. It applies the shared task rules in a single transaction and answers expected failures with results.

The MCP server lets an agent in any MCP client read and change the tasks of one project with one key, shown once and kept only as a digest. It speaks both protocol eras, names the client behind every write, sees today in the owner's time zone, and answers in compact text with short task ids, never naming another project.
