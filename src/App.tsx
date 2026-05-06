import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import AppShell from '@/components/layout/AppShell'
import AgendaPage from '@/pages/AgendaPage'
import ConversacionesPage from '@/pages/ConversacionesPage'
import AgentePage from '@/pages/AgentePage'
import MetricasPage from '@/pages/MetricasPage'
import PagosPage from '@/pages/PagosPage'
import BookingPage from '@/pages/BookingPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/booking/:barberoId" element={<BookingPage />} />
        <Route element={<AppShell />}>
          <Route path="/" element={<Navigate to="/agenda" replace />} />
          <Route path="/agenda" element={<AgendaPage />} />
          <Route path="/conversaciones" element={<ConversacionesPage />} />
          <Route path="/agente" element={<AgentePage />} />
          <Route path="/metricas" element={<MetricasPage />} />
          <Route path="/pagos" element={<PagosPage />} />
        </Route>
      </Routes>
      <Toaster position="bottom-right" richColors />
    </BrowserRouter>
  )
}
