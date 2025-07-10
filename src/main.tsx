import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Initialize GPS51 WebSocket prevention early to avoid console errors
import './services/gps51/GPS51WebSocketPrevention'

createRoot(document.getElementById("root")!).render(<App />);
