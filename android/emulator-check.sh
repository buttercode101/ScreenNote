#!/usr/bin/env bash
set -euo pipefail
mkdir -p android/emulator-evidence
# The CI runner uses a software GPU (swiftshader). Under it the bundled launcher can
# raise an "isn't responding" ANR dialog that overlays the acceptance screenshot and
# makes working offline behaviour look like an app failure. Stop the launcher before
# each run so the app is the foreground window, then fail the build if a system dialog
# is still present when the evidence is collected.
quieten_launcher() {
  for pkg in com.google.android.apps.nexuslauncher com.android.launcher3; do
    adb shell am force-stop "$pkg" >/dev/null 2>&1 || true
  done
}
assert_no_system_dialog() {
  local mode="$1"
  adb shell uiautomator dump /sdcard/window-dump.xml >/dev/null 2>&1 || return 0
  if adb shell cat /sdcard/window-dump.xml 2>/dev/null | grep -qiE "isn.t responding|has stopped"; then
    echo "::error::A system ANR dialog was on screen during ${mode} acceptance evidence; the screenshot is contaminated."
    return 1
  fi
  return 0
}
run_mode() {
  local mode="$1" result=0
  quieten_launcher
  # Headless CI has no supported host video accelerator. Prefer Android's own
  # software codecs; preserve real MediaRecorder, consent, 65s capture and import.
  # AOSP Codec2InfoBuilder defines value 3 as c2.android.* ranked first.
  adb shell setprop debug.stagefright.ccodec 3
  test "$(adb shell getprop debug.stagefright.ccodec | tr -d '\r')" = 3
  adb logcat -c
  adb logcat -v threadtime > "android/emulator-evidence/${mode}-logcat.txt" 2>&1 &
  local log_pid=$!
  ./android/gradlew -p android --no-daemon connectedDebugAndroidTest || result=$?
  kill "$log_pid" 2>/dev/null || true
  adb shell dumpsys media.codec > "android/emulator-evidence/${mode}-codecs.txt" 2>&1 || true
  if [ "$result" = 0 ] && [ "$mode" = phone ]; then
    if ! grep -q 'c2.android.avc.decoder' "android/emulator-evidence/${mode}-logcat.txt"; then
      echo "::error::Software H.264 decoder selection was not observed; do not treat this run as deterministic software-codec acceptance."
      result=1
    fi
  fi
  free -m > "android/emulator-evidence/${mode}-host-memory.txt"
  adb shell uiautomator dump /sdcard/window-dump.xml >/dev/null 2>&1 || true
  adb pull /sdcard/window-dump.xml "android/emulator-evidence/${mode}-window.xml" >/dev/null 2>&1 || true
  if ! adb pull /sdcard/Pictures/AndroidAcceptance android/emulator-evidence/; then
    if [ "$result" = 0 ]; then return 1; fi
  fi
  if [ -d android/app/build/reports/androidTests/connected ]; then
    cp -R android/app/build/reports/androidTests/connected "android/emulator-evidence/${mode}-reports"
  fi
  assert_no_system_dialog "$mode" || result=1
  return "$result"
}
run_mode phone
adb shell wm size 1600x2560
adb shell wm density 240
run_mode tablet

adb shell wm size 1280x720
adb shell wm density 240
run_mode landscape
adb shell wm size reset
adb shell wm density reset
