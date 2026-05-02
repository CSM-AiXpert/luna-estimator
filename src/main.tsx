import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { TRPCProvider } from '@/providers/trpc'
import { SupabaseAuthProvider } from '@/providers/SupabaseAuthProvider'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <SupabaseAuthProvider>
        <TRPCProvider>
          <App />
        </TRPCProvider>
      </SupabaseAuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
