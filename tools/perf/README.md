# @todz/perf

The performance harness of todz: it drives the Worker from outside with scheduled load, a local stress ramp and a bounded production run, reads the macOS app's probe and a saved Worker tail, and checks every result against the budgets that ADR 0061 writes down.
