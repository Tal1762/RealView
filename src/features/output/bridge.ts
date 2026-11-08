import type { Signal } from '../../types/api';

/** Same-machine WebRTC only: signaling stays in IPC, no STUN/TURN or external host. */
export function publishCanvas(canvas: HTMLCanvasElement, fps: number, mirror: () => boolean, status: (value: string) => void) {
  let peer: RTCPeerConnection | null = null, stream: MediaStream | null = null;
  let pending: RTCIceCandidateInit[] = [], generation = 0;
  const stop = () => { generation++; peer?.close(); peer = null; stream?.getTracks().forEach(t => t.stop()); stream = null; pending = []; };
  const unsubscribe = window.roomshift.onSignal((signal: Signal) => {
    void (async () => {
      if (signal.type === 'closed') { stop(); status('Output closed'); }
      if (signal.type === 'ready') {
        stop(); const token = generation;
        const current = new RTCPeerConnection({ iceServers: [] }); peer = current;
        stream = canvas.captureStream(fps);
        stream.getTracks().forEach(track => current.addTrack(track, stream!));
        current.onicecandidate = e => { if (e.candidate) window.roomshift.signal({ type: 'ice', data: e.candidate.toJSON() }); };
        current.onconnectionstatechange = () => status(current.connectionState === 'connected' ? 'Output live' : `Output ${current.connectionState}`);
        await current.setLocalDescription(await current.createOffer());
        if (token !== generation) return;
        window.roomshift.signal({ type: 'offer', data: current.localDescription?.toJSON() });
        window.roomshift.signal({ type: 'settings', data: { mirror: mirror() } });
      }
      if (signal.type === 'answer' && peer) {
        const current = peer;
        await current.setRemoteDescription(signal.data as RTCSessionDescriptionInit);
        for (const candidate of pending) await current.addIceCandidate(candidate);
        pending = [];
      }
      if (signal.type === 'ice') {
        if (peer?.remoteDescription) await peer.addIceCandidate(signal.data as RTCIceCandidateInit);
        else pending.push(signal.data as RTCIceCandidateInit);
      }
    })().catch(error => status(`Output error: ${String(error)}`));
  });
  return () => { unsubscribe(); stop(); };
}
