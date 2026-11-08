import { createRoot } from 'react-dom/client';
import App from './App';
import { Output } from './features/output/Output';
import './styles.css';
const clean = new URLSearchParams(location.search).has('output');
createRoot(document.getElementById('root')!).render(window.roomshift ? clean ? <Output /> : <App /> : <div className="desktop-required"><h1>Open RoomShift on your desktop</h1><p>This app uses Electron for private asset storage and clean video output.</p><code>npm run dev</code></div>);
