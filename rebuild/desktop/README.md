# ScreenNote desktop companion — architecture

## Product decision

The web application ships first. A desktop companion is part of the product architecture, not a second product or a separate backend.

The desktop client should reuse the React interface and ScreenNote API, while replacing browser capture with native capture adapters where the operating system offers capabilities the browser cannot reliably provide.

## Proposed shell

- Tauri 2 for a small native application shell.
- Reuse the web UI from `../src` and the same design system.
- Rust commands expose native capture, file access, OS permissions and secure local storage.
- Keep the capture engine behind a platform-neutral interface so the UI does not depend on Windows/macOS/Linux implementation details.

## Capture adapters

| Platform | Screen capture | System audio |
|---|---|---|
| Windows | Windows Graphics Capture | WASAPI loopback |
| macOS | ScreenCaptureKit | CoreAudio / ScreenCaptureKit audio |
| Linux | xdg-desktop-portal + PipeWire | PipeWire |

Camera and microphone capture should use OS permission-aware native APIs or the browser media layer where reliable. The desktop client must never silently start capture.

## Shared product services

- Reuse the guest/session and recording metadata API.
- Reuse private R2 media storage and the same upload authorization rules.
- Keep local recordings available if the user declines cloud upload.
- Share links, playback, comments and AI processing remain server-side product capabilities, not desktop-only features.

## Desktop release gates

1. Web recording, local recovery and cloud upload are stable.
2. Native capture proof-of-concept passes on each target OS.
3. Permission prompts, system audio routing and device changes are tested.
4. Long recordings survive app crashes and OS sleep/resume.
5. Signed installers, auto-update and crash reporting are ready.

Initial desktop target order: Windows, macOS, then Linux. This is a proposed implementation direction; platform prototypes must validate capture and audio quality before a release commitment.