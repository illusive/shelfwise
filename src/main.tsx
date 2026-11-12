import '@fontsource/manrope/500.css';
import '@fontsource/manrope/600.css';
import '@fontsource/manrope/700.css';
import '@fontsource/ibm-plex-mono/400.css';
import './ui/global.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { initAuth } from './app/auth';
import { initDevTools } from './app/devTools';
import { startPwa } from './app/pwa';

initDevTools();
startPwa();

// Finishes a Microsoft sign-in redirect before routing (no-op unless Copilot Studio is set up).
void initAuth().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
