# ScreenNote Repro Capsule (Chrome / Edge)

A small Manifest V3 extension that captures an explicit, local interaction outline for a ScreenNote bug report.

## Install

1. Open `chrome://extensions` in Chrome or `edge://extensions` in Edge.
2. Enable **Developer mode**.
3. Choose **Load unpacked** and select this `rebuild/extension` directory.
4. Open the web page you want to reproduce.
5. Click the extension, choose **Start capture**, perform the steps, then reopen the extension and choose **Stop & review**.
6. Review/edit the JSON, remove anything sensitive, and download it.
7. In ScreenNote, open a recording → **Edit** → **Captions & context** → **Bug report** → **Import Repro Capsule**. Review the imported URL, steps and environment, then save context only when you choose.

## Exactly what it captures

- The page URL with username/password, query string and fragment removed.
- Page title, browser user-agent string and viewport dimensions.
- Up to 500 click outlines (interactive target tag/role and a short accessible/button label).
- Navigation keys only: Enter, Escape, Tab, arrows and Space. No typed characters or field values.
- Relative timestamps and capture duration.

## Privacy and limitations

- Capture starts only after the user clicks **Start capture** and stops only after **Stop & review**.
- The extension has no host permissions, background listeners, analytics or network code. It uses the temporary `activeTab` permission and injected listeners in the selected tab.
- It does not capture screenshots, page body text, cookies, form values, clipboard, network requests, console logs or credentials.
- A clicked button/link label or the URL path can still contain personal information. Review and redact the JSON before export; ScreenNote removes URL credentials/query/hash again on import.
- The JSON is not uploaded by the extension. Importing into ScreenNote fills the local bug-report editor; publishing the share sends the saved context to the temporary share and makes it visible to link viewers.
- This is a user-approved interaction outline, not a complete automated reproduction or telemetry trace. It cannot observe server state or reproduce every browser/device condition.

No dependencies or paid services are required.
