# Third-party notices

RoomShift source and original demo artwork, example scene, procedural models, and application icon are provided under the MIT license in `LICENSE`.

- **MediaPipe Tasks Vision and Selfie Segmenter** — Google, Apache License 2.0. Runtime installed from `@mediapipe/tasks-vision`; model downloaded from `https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/1/selfie_segmenter.tflite`. SHA-256: `191ac9529ae506ee0beefa6b2c945a172dab9d07d1e802a290a4e4038226658b`. [MediaPipe license](https://github.com/google-ai-edge/mediapipe/blob/master/LICENSE). Packaged runtime and model operate offline.
- **Electron** — OpenJS Foundation and contributors, MIT; Chromium and embedded components have their own notices. The Windows package includes Electron's `LICENSE.electron.txt` and `LICENSES.chromium.html`.
- **React, Three.js, React Three Fiber, Drei, Zustand, Zod, Tailwind CSS, Radix UI, class-variance-authority, clsx, tailwind-merge** — respective authors; MIT licenses included in installed packages.
- **Lucide icons** — Lucide contributors, ISC license.
- The local Button primitive follows the open-source shadcn/ui composition pattern (MIT). It is styled locally and does not load a remote UI service.

The complete dependency versions are pinned by `package-lock.json`. Runtime license texts and the Apache 2.0 license are bundled in `assets/licenses/`. Build-tool licenses remain in their installed package directories.
