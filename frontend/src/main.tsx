import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './index.css'
import App from './App.tsx'
import { Toaster } from '@/components/ui/sonner'
import { PrototypeSwitcher263 } from '@/prototype/Switcher263'

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        <Toaster />
        <PrototypeSwitcher263 />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
