import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import './index.scss'
import './common.scss'

import App from './App.tsx'
import Categorize from './routes/Categorize.tsx'

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/categorize" element={<Categorize />} />
        </Routes>
      </QueryClientProvider>
    </StrictMode>
  </BrowserRouter>,

  // <StrictMode>
  //   <App />
  // </StrictMode>,
)
