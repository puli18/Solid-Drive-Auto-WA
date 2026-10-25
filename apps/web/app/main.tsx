/**
 * SPA entry. Fonts (Foundation decision – see docs/DECISIONS.md), self-hosted via Fontsource:
 *  - Archivo (variable, wdth 62–125) → `font-display` (--font-archivo)
 *  - Geist → `font-sans` (--font-geist)
 *  - Geist Mono → `font-mono` (--font-geist-mono)
 */
import '@fontsource-variable/archivo/wdth.css';
import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import './globals.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';
import { router } from './routes';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
