# ScreenNote rebuild tests

The first unit tests validate browser recording format negotiation. They do not certify real screen-capture permissions, media encoding, storage persistence, upload recovery, Worker bindings, or cross-browser playback.

Those behaviors require Worker-runtime integration tests and browser/device acceptance. Never mark those gates passed from unit tests alone.