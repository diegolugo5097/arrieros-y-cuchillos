import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import '@fontsource/rye';
import '@fontsource/nunito/400.css';
import '@fontsource/nunito/600.css';
import '@fontsource/nunito/800.css';
import './styles.css';
import './mesa.css';
import './fx.css';

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
