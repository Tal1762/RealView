# RoomShift verification record

Verification performed on Windows 11 x64 (build 26200), Node.js 24.14.1, Electron 45.2.3. This is an implementation and automated-test record, not a claim that real webcam/OBS acceptance has been completed.

## Automated results

| Check | Result |
| --- | --- |
| Strict renderer/main/preload TypeScript compilation | Passed |
| Production Vite and Electron bundles | Passed |
| Vite/Electron development launch | Passed with synthetic camera and local MediaPipe inference; dev-only CSP nonce permits the React refresh preamble |
| ESLint | Passed |
| Vitest critical logic | 15 tests passed |
| Synthetic-camera Electron integration | Passed; see the latest generated `test-results/smoke.json` |
| MediaPipe local WASM/model startup and inference | Passed on synthetic camera frames |
| GPU camera color/perspective/window frame pixels | Passed |
| Deterministic foreground mask occlusion/feathering | Passed with zero/full/half-confidence masks |
| PNG and self-contained GLB import | Passed with native-dialog stubs and local fixtures |
| Mirrored 3D gizmo pointer dragging and undo | Passed using actual rendered axis pixels and pointer events |
| Managed copy survives removal of original asset | Passed |
| Scene saves and restores after renderer reload | Passed |
| Clean output video in a second Electron window | Passed, 1280×720 through local WebRTC, no editor buttons |
| Camera permission denial/retry | Passed with a mocked denial and synthetic camera retry |
| IPC path traversal rejection / no renderer Node access | Passed |
| Windows x64 NSIS installer build | Built successfully |
| Packaged Windows executable | Passed: launch, synthetic camera, bundled inference, example scene, save/load and output window |
| Production dependency audit | 0 advisories at verification time |

The full npm audit also reported 15 moderate **development-tool dependency** advisories, rooted in minimatch glob amplification. They are in the lint/packaging dependency graph, not the packaged runtime. They have not been hidden using a forced incompatible downgrade. Review updated tooling before a public release.

The initial persistence test could not perform an atomic rename inside the tool's restricted system temporary directory. Test fixtures now use `.local-test` inside the workspace; the tests pass both inside and outside the tool sandbox, and the atomic implementation was retained. The synthetic-camera run also exposed preview sizing, frame color, and 3D viewport alignment issues, which were fixed and visually rechecked. Model selection suppresses wall-art hit regions so overlapping posters cannot intercept gizmo drags. TensorFlow Lite's `INFO: Created ... XNNPACK delegate` message is informational despite being emitted on the error console; the integration runner excludes only that exact known message.

## Required manual Windows acceptance

These items are **unverified** unless a human records the outcome below. The application is implemented; physical hardware and OBS interoperability are still required to call the full product acceptance criteria complete.

1. **Install / launch / uninstall:** Run `release/RoomShift-Setup-0.1.0-x64.exe` on a Windows 10 x64 machine and a Windows 11 x64 machine. Choose a destination, verify the shortcut, launch offline, and verify uninstall. Confirm the app's name/icon/version and that no administrator access is unexpectedly required. The release is unsigned.
2. **Real camera:** Select each attached physical webcam, verify live motion, mirror preview on/off, switch devices repeatedly, and check that the old camera's indicator turns off. Deny Windows permission and retry after enabling it. Unplug/reconnect a camera. Test a device already in use by another application.
3. **Wall placement:** Import your own PNG and JPEG, click the four wall corners, drag corners, move/resize/rotate, and confirm stationary alignment. Check mirror-preview changes leave placement fixed relative to the room. Read text in the unmirrored output. Undo and redo corner drags.
4. **Human occlusion:** Stand in front of both artwork and a 3D model. Move hands across the borders, vary lighting, and inspect hair, clothing, chair edges, transparent items and rapid movement. Compare all processing rates. Record acceptable/poor cases; deterministic GPU mask tests do not test the model's ability to recognize an actual person.
5. **GLB transforms:** Import a representative embedded textured GLB from your modeling tool. Click to select; drag all three move/rotate/scale axes with preview mirroring on and off; inspect selection-box alignment. Reset, hide, delete, undo and reload. Confirm a compressed or external-texture GLB gives a useful error.
6. **Persistence through process restart:** Save a renamed scene, close the whole app, move/delete original image/model files, relaunch offline, and compare placements, textures, visibility, opacity and output settings. Test New/Open/Delete saved rooms. Back up files before deliberately corrupting a scene to test the warning.
7. **OBS capture:** Add Window Capture for **RoomShift Output**. Test Windows 10/Automatic/BitBlt capture methods, Client Area and cursor settings, window resizing, and 100%/125%/150% display scaling. Keep both RoomShift windows restored. Test multiple monitors and GPU assignments. Confirm corner handles, selection outlines, editor watermark and panels never enter the clean output. Check reopening the output window.
8. **Actual call:** Start OBS Virtual Camera. Select it in Zoom, Meet, Teams and Discord individually. Join a test call with a second device/account and inspect the **received** view for orientation, visible artwork, human occlusion, resolution, latency and stability. Use a separate microphone. These apps and OBS were not controlled during automated verification.
9. **Performance / endurance:** Run a real-camera scene for 30 minutes at 1280×720/30 with occlusion, several posters/windows and a textured GLB. Record CPU/GPU usage, memory, fps and meeting output delay. Repeat at 640×360/15 if necessary. Check that repeated import/remove and output open/close do not leave streams or windows running.

## Screenshots

`npm run test:integration` produces real screenshots in `test-results/editor.png`, `test-results/model-controls.png`, and `test-results/output.png`. Their green clock/background is Chromium's synthetic camera, not a real room, fabricated product photo, or hardware verification. `test-results/gpu.json` contains measured pixel values from WebGL.
