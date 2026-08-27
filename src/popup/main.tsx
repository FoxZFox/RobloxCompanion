import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { CommandCenter } from '../components/CommandCenter';

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <CommandCenter surface="popup" />
    </StrictMode>,
  );
}
