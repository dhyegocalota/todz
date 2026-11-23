# @todz/api

The Worker behind the MCP server and the owner API. A directory knows who owns which workspace and project and which credential opens which project; each project keeps its tasks and their history in a store of its own. A credential reaches a project only through the directory, so no read or write ever crosses a project boundary. It applies the shared task rules in a single transaction and answers with results, never with thrown errors.
