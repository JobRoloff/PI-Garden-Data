import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from 'next-themes';
import { GardenStreamProvider } from './app/GardenStreamProvider';
import App from './app/App';
import './styles/index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <GardenStreamProvider>
        <App />
      </GardenStreamProvider>
    </ThemeProvider>
  </StrictMode>
);
