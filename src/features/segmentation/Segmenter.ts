export class Segmenter {
  private worker: Worker;
  private ready = false;
  private busy = false;
  private stopped = false;
  private last = 0;
  private frameTime = -1;
  private hasMask = false;
  constructor(private onMask: (bytes: Uint8Array, width: number, height: number) => void, private onStatus: (status: string) => void) {
    onStatus('Loading person mask…');
    this.worker = new Worker(new URL('assets/segmentation-worker.js', document.baseURI));
    this.worker.onmessage = event => {
      if (event.data.type === 'ready') { this.ready = true; onStatus('Occlusion ready'); }
      if (event.data.type === 'mask') { this.busy = false; onMask(event.data.bytes, event.data.width, event.data.height); if (!this.hasMask) { this.hasMask = true; onStatus('Occlusion active'); } }
      if (event.data.type === 'error') { this.ready = false; this.busy = false; onStatus(`Occlusion unavailable: ${event.data.message}`); }
    };
    this.worker.onerror = event => { this.ready = false; this.busy = false; onStatus(`Occlusion unavailable: ${event.message}`); };
    this.worker.postMessage({ type: 'init', base: new URL('assets/mediapipe/', document.baseURI).href });
  }
  tick(video: HTMLVideoElement, now: number, quality: 'fast' | 'balanced' | 'quality') {
    const rate = quality === 'fast' ? 10 : quality === 'balanced' ? 15 : 24;
    if (!this.ready || this.busy || this.stopped || video.readyState < 2 || now - this.last < 1000 / rate || video.currentTime === this.frameTime) return;
    this.busy = true; this.last = now; this.frameTime = video.currentTime;
    // One in-flight bitmap bounds memory and prevents inference backlog.
    void createImageBitmap(video).then(frame => {
      if (this.stopped) { frame.close(); return; }
      this.worker.postMessage({ type: 'frame', frame, timestamp: now }, [frame]);
    }).catch(error => { this.busy = false; this.onStatus(`Mask frame failed: ${String(error)}`); });
  }
  dispose() { this.stopped = true; this.worker.terminate(); }
}
