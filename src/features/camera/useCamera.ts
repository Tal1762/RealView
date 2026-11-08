import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Scene } from '../scene/schema';
export function useCamera(config: Scene['camera'], output: Scene['output']) {
  const video = useMemo(() => { const v = document.createElement('video'); v.muted = true; v.playsInline = true; return v; }, []);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [status, setStatus] = useState('Starting camera…');
  const [active, setActive] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [retry, setRetry] = useState(0);
  const [resolution, setResolution] = useState('—');
  const enumerate = useCallback(async () => {
    try { setDevices((await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput')); }
    catch { setStatus('Camera enumeration unavailable.'); }
  }, []);
  useEffect(() => {
    void enumerate();
    navigator.mediaDevices?.addEventListener('devicechange', enumerate);
    return () => navigator.mediaDevices?.removeEventListener('devicechange', enumerate);
  }, [enumerate]);
  useEffect(() => {
    let cancelled = false, stream: MediaStream | null = null;
    setActive(false);
    if (!enabled) { setStatus('Camera off'); return; }
    setStatus('Starting camera…');
    void (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { deviceId: config.deviceId ? { exact: config.deviceId } : undefined, width: { ideal: output.width }, height: { ideal: output.height }, frameRate: { ideal: output.fps, max: output.fps } } });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        video.srcObject = stream;
        await video.play();
        if (cancelled) return;
        stream.getVideoTracks()[0].addEventListener('ended', () => {
          if (cancelled) return;
          stream?.getTracks().forEach(t => t.stop()); video.srcObject = null;
          setActive(false); setStatus('Camera disconnected. Reconnect it and press Retry.');
        });
        setActive(true); setStatus('Camera live');
        setResolution(`${video.videoWidth} × ${video.videoHeight}`);
        await enumerate();
      } catch (error) {
        stream?.getTracks().forEach(t => t.stop());
        if (cancelled) return;
        const name = error instanceof DOMException ? error.name : '';
        setStatus(name === 'NotAllowedError' ? 'Camera access denied. Enable desktop camera access in Windows Settings → Privacy & security → Camera.' : name === 'NotFoundError' || name === 'OverconstrainedError' ? 'Camera unavailable. Select another camera or reconnect it.' : name === 'NotReadableError' ? 'Camera is busy or unavailable. Close other camera apps and retry.' : `Camera failed: ${String(error)}`);
      }
    })();
    return () => { cancelled = true; stream?.getTracks().forEach(t => t.stop()); video.srcObject = null; };
  }, [config.deviceId, output.width, output.height, output.fps, enabled, retry, video, enumerate]);
  return { video, devices, status, active, resolution, enabled, toggle: () => setEnabled(v => !v), retry: () => { setEnabled(true); setRetry(v => v + 1); } };
}
