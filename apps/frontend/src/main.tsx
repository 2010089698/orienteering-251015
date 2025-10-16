import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { StartlistProvider } from './state/StartlistContext';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <StartlistProvider>
      <App />
    </StartlistProvider>
  </React.StrictMode>,
);
