import { useEffect, useRef, useState } from 'react';
export function Output() {
  const video = useRef<HTMLVideoElement>(null);
  const [mirror, setMirror] = useState(false), [error, setError] = useState('Connecting to RoomShift…'), [live, setLive] = useState(false);
  useEffect(() => {
    document.title = 'RoomShift Output';
    const peer = new RTCPeerConnection({ iceServers: [] });
    let pending: RTCIceCandidateInit[] = [];
    peer.ontrack = e => { if (video.current) { video.current.srcObject = e.streams[0]; void video.current.play().catch(e => setError(String(e))); } };
    peer.onconnectionstatechange = () => { if (peer.connectionState === 'failed' || peer.connectionState === 'disconnected') { setLive(false); setError('Output disconnected. Close this window and reopen it in RoomShift.'); } };
    peer.onicecandidate = e => { if (e.candidate) window.roomshift.signal({ type: 'ice', data: e.candidate.toJSON() }); };
    const off = window.roomshift.onSignal(signal => {
      void (async () => {
        if (signal.type === 'settings' && typeof signal.data === 'object' && signal.data !== null && 'mirror' in signal.data) setMirror(signal.data.mirror === true);
        if (signal.type === 'offer') {
          await peer.setRemoteDescription(signal.data as RTCSessionDescriptionInit);
          for (const candidate of pending) await peer.addIceCandidate(candidate);
          pending = [];
          await peer.setLocalDescription(await peer.createAnswer());
          window.roomshift.signal({ type: 'answer', data: peer.localDescription?.toJSON() });
        }
        if (signal.type === 'ice') {
          if (peer.remoteDescription) await peer.addIceCandidate(signal.data as RTCIceCandidateInit);
          else pending.push(signal.data as RTCIceCandidateInit);
        }
      })().catch(error => { setLive(false); setError(`Output failed: ${String(error)}`); });
    });
    window.roomshift.signal({ type: 'ready' });
    return () => { off(); peer.close(); };
  }, []);
  return <main className="output"><video ref={video} autoPlay playsInline muted onPlaying={() => setLive(true)} style={{ transform: mirror ? 'scaleX(-1)' : undefined }} />{!live && <p>{error}</p>}</main>;
}
