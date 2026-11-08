import { FilesetResolver, ImageSegmenter } from '@mediapipe/tasks-vision';
let segmenter: ImageSegmenter | undefined;
let previous: Float32Array | undefined;
self.onmessage = async (event: MessageEvent) => {
  const data = event.data;
  try {
    if (data.type === 'init') {
      const files = await FilesetResolver.forVisionTasks(data.base + 'wasm');
      segmenter = await ImageSegmenter.createFromOptions(files, { baseOptions: { modelAssetPath: data.base + 'selfie_segmenter.tflite', delegate: 'CPU' }, runningMode: 'VIDEO', outputConfidenceMasks: true, outputCategoryMask: false });
      self.postMessage({ type: 'ready' });
    } else if (data.type === 'frame' && segmenter) {
      const frame = data.frame as ImageBitmap;
      try {
        segmenter.segmentForVideo(frame, data.timestamp, result => {
          const mask = result.confidenceMasks?.[0];
          if (!mask) throw new Error('No person confidence mask returned.');
          const values = mask.getAsFloat32Array();
          if (!previous || previous.length !== values.length) previous = new Float32Array(values);
          const bytes = new Uint8Array(values.length);
          for (let i = 0; i < values.length; i++) {
            previous[i] = 0.8 * values[i] + 0.2 * previous[i];
            bytes[i] = Math.round(previous[i] * 255);
          }
          self.postMessage({ type: 'mask', bytes, width: mask.width, height: mask.height, timestamp: data.timestamp }, { transfer: [bytes.buffer] });
        });
      } finally { frame.close(); }
    }
  } catch (error) { self.postMessage({ type: 'error', message: String(error) }); }
};
