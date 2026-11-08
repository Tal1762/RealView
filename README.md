# RoomShift

A local Windows desktop studio for decorating a stationary webcam view. Place perspective-correct artwork and virtual windows, import 3D objects, keep people in front with MediaPipe, and send a clean video surface to OBS Virtual Camera.

## Run

Use Windows 10/11 x64, a WebGL 2 capable GPU, and Node.js 24 LTS. A physical webcam and OBS Studio are needed for real meeting use.

```powershell
npm ci
npm run dev
```

The first development run downloads the versioned MediaPipe Selfie Segmenter model from Google and copies the installed MediaPipe WASM runtime into `public/assets/mediapipe`. Its SHA-256 is checked. Subsequent runs work offline. npm dependencies and Electron are also downloaded during installation/first launch. No model downloads happen in the packaged app.

```powershell
npm run build       # offline assets + strict TS + Vite + Electron bundles
npm start           # launch the production build
npm run package     # build the Windows x64 NSIS installer
```

The installer is written to `release/RoomShift-Setup-0.1.0-x64.exe`. The unpacked executable is `release/win-unpacked/RoomShift.exe`. This development release is unsigned; a release signing certificate is not configured. The installer creates an uninstall entry and an optional desktop shortcut. Installing the app or OBS is not performed by the build script.

## Use your room

1. Choose your camera in the top bar. If access is denied, enable **Let desktop apps access your camera** in Windows camera privacy settings, then click **Retry camera**. Close other camera applications if the device is busy.
2. Choose **Add poster**, import a PNG/JPEG, and click its four corners in this order: **top left → top right → bottom right → bottom left in the displayed preview**. Complete a convex perimeter. The built-in artwork works without importing anything.
3. Drag a corner to change perspective; drag inside the selected decoration to move it. The inspector provides size, rotation, opacity, visibility, and numeric corner controls. Invalid/crossed corner edits are rejected. Surface layer order is back-to-front in the list.
4. Add a **Virtual window** with an imported image or the bundled coastal illustration. Set the frame color and width in Properties. Its perspective and person occlusion use the same pipeline as posters.
5. Choose **3D model** for a self-contained glTF 2.0 `.glb`, or add the procedural desk plant and loop sculpture. Select the object, then use Move/Rotate/Scale gizmos or numeric fields. The selection box and gizmos are editor-only. **Reset transform** restores the default placement.
6. Use **Camera & output** (sliders icon) for resolution, frame rate, independent preview/output mirroring, occlusion, mask processing rate, and 3D camera field of view.
7. Edit the room name in the top bar and press **Save**. The folder button lists saved rooms and provides New/Open/Delete. Changing the room name and saving renames the stored scene. The most recently saved room restores on next launch. Save before closing: edits are not automatically saved.
8. **Try an example room** loads the bundled Coastal studio scene; adjust its placements for your own camera. It is an actual scene, not a simulated webcam background.

Shortcuts: **Ctrl+S** save; **Ctrl+Z** undo; **Ctrl+Shift+Z** or **Ctrl+Y** redo; **Delete/Backspace** remove selected object; **Esc** cancel placement/deselect. Shortcuts do not intercept input fields. Corner drags and 3D gizmo drags each form one undo transaction; history keeps up to 50 steps.

### Coordinate conventions

- Scenes use the unmirrored camera image as their canonical coordinate system. Surface coordinates are normalized top-left `(0,0)` to bottom-right `(1,1)`, independent of output resolution.
- Four-point calibration solves a full projective homography; the shader inverse-maps every output pixel into the image texture. There is no affine triangle seam.
- Preview mirroring is a display transform. Newly calibrated corners are reordered into the canonical image coordinate system. Text in artwork looks mirrored in a mirrored editor and reads normally in the default unmirrored output.
- Camera input is center-cropped to 16:9. Changing camera, its field of view, physical position, or crop requires recalibration. There is no SLAM or automatic wall tracking.
- The 3D camera is at `(0,0,0)`, looking along `−Z`, with `+X` right and `+Y` up. Default vertical FOV is 50°. Imported model bounds are centered and normalized to a longest dimension of one unit. Positions are scene units, rotations are stored as radians (shown as degrees), and scales are dimensionless.
- 3D objects depth-test against each other. The 3D pass is composited above the wall-art pass; the person mask occludes both. Surface reordering does not move a wall image in front of a 3D object. There is no physical room depth or realistic room-light estimation.

## OBS and meeting apps

RoomShift provides an **OBS bridge**, not a registered Windows camera driver.

1. Install and open [OBS Studio](https://obsproject.com/).
2. In RoomShift choose **Go live → Open output window**. Keep the editor and **RoomShift Output** open and restored.
3. In OBS, add a **Window Capture** source and select **RoomShift Output**. Prefer **Windows 10 (1903 and up)** / Windows Graphics Capture where offered, enable **Client Area**, and turn off **Capture Cursor**. Window names can vary by OBS version. [OBS Window Capture documentation](https://obsproject.com/kb/window-capture-sources).
4. Set OBS's base/output video canvas to 1280×720 (or the RoomShift output resolution), then right-click the source → Transform → Fit to screen. Match the frame rate. Capture the output window, not the editor.
5. In OBS Controls click **Start Virtual Camera**. Use Program or explicitly select the desired scene/source in virtual-camera settings. [Official Virtual Camera guide](https://obsproject.com/kb/virtual-camera-guide).
6. In Zoom, Google Meet, Teams, or Discord camera settings choose **OBS Virtual Camera**. Leave your microphone selected separately; RoomShift never requests microphone access. Turn off meeting-app background replacement/blur if it interferes. If a meeting app mirrors its local preview, inspect the received video from another device to judge the actual output.

### Capture compatibility

- Do **not minimize** the editor or output window. `backgroundThrottling: false` reduces Chromium throttling, but cannot guarantee capture of minimized/fully occluded windows or rendering through a locked/sleeping Windows session. OBS contributors describe these OS/app rendering limits in [this minimized-window discussion](https://obsproject.com/forum/threads/issue-while-window-capture.161911/).
- If capture is black, try Automatic, then Windows 10 capture, then BitBlt. BitBlt has different compatibility/performance characteristics. Ensure OBS and RoomShift run on the same GPU on multi-GPU laptops. Leave the output visible while diagnosing.
- DPI scaling can make the captured client area larger than the requested logical window size. Fit/crop the source in OBS, use a 16:9 window, and test each monitor at your chosen 100%/125%/150% scaling. The video is rendered at its configured pixel resolution, independently of window size.
- Local WebRTC transfers the same clean canvas to the output window with no STUN/TURN servers. It introduces encoding/copy overhead and some latency. A machine under heavy GPU load may need 640×360, 15 fps, or lighter segmentation.
- “Output live” means the local window's WebRTC connection is connected. It does **not** mean OBS is capturing, Virtual Camera is running, or a meeting app is receiving video. OBS detection only checks standard install directories; portable/custom installations may be reported as not found.

## Privacy, storage, and security

All frames, inference, assets, and scene files stay on the device. No telemetry, accounts, backend, recordings, or external AI APIs are used. The production renderer blocks remote network requests. The only external link opens the official OBS guide in your default browser when clicked.

Scene storage lives under Electron's user-data directory, normally `%APPDATA%\roomshift\library` (the installed product may use `%APPDATA%\RoomShift\library`). `scenes/<uuid>.json` holds a versioned schema; `assets/<sha256>.<extension>` holds managed imports. Scenes store camera IDs, timestamps, render settings, calibration, transforms, and object references. Save uses a temporary file and atomic rename; corrupt entries are skipped and reported. Asset references are allowlisted; missing files do not prevent other objects from loading. Deleting a scene deliberately retains imported assets to avoid breaking other scenes. Back up the whole library directory to move scenes and assets together.

The Electron renderer is sandboxed with context isolation, no Node integration, a restrictive CSP, and denied navigation/popups. A typed preload exposes only scene, import-dialog, fixed OBS-guide, and output-signaling operations. Main-process handlers validate the sender window/main frame, schema, UUIDs, file types and sizes. Managed assets are served by a restricted custom protocol. Arbitrary paths and external GLB resources are rejected.

Import limits: PNG/JPEG up to 25 MB and 8192 pixels per dimension; GLB up to 100 MB. External `.gltf` dependencies, Draco/Meshopt compressed GLB, and KTX2 textures are not supported. Export an uncompressed, embedded GLB. Malformed or empty geometry produces a useful error instead of replacing the scene. Extremely complex models can still use substantial GPU memory; simplify them before import.

The model is Google's [MediaPipe Selfie Segmenter](https://ai.google.dev/edge/mediapipe/solutions/vision/image_segmenter), version `float16/1`, bundled with its source URL, SHA-256 and license information in `assets/mediapipe/manifest.json`. See `THIRD_PARTY_NOTICES.md`.

## Architecture

```text
electron/main.ts              windows, IPC authorization, local protocols, camera permissions
electron/preload.ts           small typed contextBridge API
electron/storage.ts           atomic scene persistence and corruption handling
electron/assets.ts            content-addressed asset import validation
src/features/camera/          camera selection, retry, teardown and device changes
src/features/calibration/     convexity, homography, quad transforms
src/features/compositor/      GPU image/window composition; R3F/Drei model stage
src/features/segmentation/    bounded worker inference + temporal/spatial feathering
src/features/output/          local canvas WebRTC transport and output-only renderer
src/features/scene/           Zod schema and serialization
src/stores/                   Zustand scene/undo transactions
src/components/               desktop studio, property controls, calibration and UI primitives
```

Each requestAnimationFrame tick renders clean R3F models, then composites the camera, perspective surfaces and model pass through a confidence mask. The model stage then renders only editor gizmos/outlines to its separate editor surface. The clean output canvas never contains those controls or the editor watermark. Resources are reused, and GLTF geometries/materials/textures, video tracks, workers, WebRTC peers, and render targets are disposed on replacement/unmount. Camera acquisition and inference failures leave the editor usable.

Segmentation uses a classic worker with local WASM/CPU inference, one transferred bitmap in flight, and a throttle of 10/15/24 masks per second. The latest mask has 80/20 temporal smoothing, spatial sampling and a soft threshold. Masks older than 600 ms are not applied. Final compositing runs independently at the chosen frame target. The bottom bar reports delivered render fps and average render time (excluding asynchronous inference and OBS).

The output transport is separate from the compositor so a native virtual-camera backend can replace the OBS bridge later. Window imagery is a reusable surface asset, allowing future video textures; neither animated scenery nor head tracking is implemented.

## Tests and verification

```powershell
npm run typecheck
npm run lint
npm test
npm run build
npm run test:integration
npm run test:packaged   # after npm run package
node scripts/smoke-dev.mjs  # after npm run build; verifies the Vite/Electron path
```

The integration runner launches real Electron windows on Windows with Chromium's **synthetic camera**, isolated data in `.local-test`, and stubbed native file dialogs. It does not access or record a physical webcam. It writes actual application screenshots and results to `test-results` (gitignored). A temporary GPU harness is removed after the run. The packaged smoke test launches `release/win-unpacked/RoomShift.exe` with the standard `--user-data-dir` profile override and synthetic-camera flags, verifying bundled inference, the example scene, saving and clean output.

Automated coverage includes:

- Schema validation, scene serialization, atomic save/reload/rename/delete, corrupt JSON, missing references and path traversal.
- Homography corner/interior projection, inverse mapping, convexity, translation/scale/rotation.
- Undo/redo, grouped transforms, ordering, validation and concurrent-save dirty state.
- Actual mirrored 3D gizmo pointer dragging and undo, including overlapping wall art.
- Native PNG/GLB import handling, external-dependency rejection, content-addressed copies surviving deletion of the original.
- Actual camera startup with synthetic video, actual bundled MediaPipe initialization/inference, mocked permission denial and retry.
- Actual WebGL pixel assertions for camera colors, calibrated surfaces, window frame color, full foreground occlusion, transparent edges, visibility and occlusion toggling.
- Clean output WebRTC negotiation/video dimensions, absence of UI controls, editor preview toggle, scene restoration after reload, and IPC restrictions.

See `VERIFICATION.md` for the recorded results and the remaining hardware/OBS checklist. Tests of synthetic frames do not prove human segmentation quality or real meeting interoperability.

## MVP limitations and next work

- Stationary-camera/manual calibration only; moving the camera invalidates placement. No physical plane detection, depth sensing, room occluders, parallax, or relighting.
- Hair, fingers, fast motion, transparent items, clothing near background colors, and chairs can be misclassified. Mask latency can leave brief edge trails. Chairs/other objects are not reliably foreground unless the model includes them. Tune lighting, lower output cost, or turn occlusion off when it looks worse.
- 720p near 30 fps is a target, not a guarantee. Output window transfer, segmentation and model complexity all add cost. Inference is intentionally on CPU in a worker for predictable isolation; GPU inference is future work.
- Model animations, skin animation playback, compressed textures/geometry, multi-file GLTF, native virtual-camera output, and audio are outside this MVP.
- Scene asset garbage collection, portable scene export/import, installer signing, crash recovery/autosave, exhaustive model compatibility, and independent GPU fallback are next steps. GPU context loss currently asks for a restart.
- Renderer tests and a built installer are not a substitute for the physical webcam, OBS, meeting-client and installer verification steps below.
