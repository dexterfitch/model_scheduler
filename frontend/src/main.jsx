/**
 * Starts the app, with the shared confirmation and message windows available everywhere.
 */

import './assets/styles/bootstrap-custom.scss';
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { DialogProvider } from './components/DialogProvider'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <DialogProvider>
      <App />
    </DialogProvider>
  </StrictMode>
)
