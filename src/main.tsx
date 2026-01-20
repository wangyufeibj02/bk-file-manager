import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { ToastProvider } from './contexts/ToastContext.tsx'
import { PreviewProvider } from './contexts/PreviewContext.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ToastProvider>
      <PreviewProvider>
        <App />
      </PreviewProvider>
    </ToastProvider>
  </React.StrictMode>,
)
