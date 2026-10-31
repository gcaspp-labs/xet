import { Navigate, Outlet, Route, Routes } from 'react-router'
import { useCurrentUser } from '@/lib/auth'
import HomePage from '@/pages/HomePage'
import LoginPage from '@/pages/LoginPage'

// Rotas que exigem sessão; sem sessão, vai para o login.
function RequireAuth() {
  const { data: user, isPending } = useCurrentUser()
  if (isPending) {
    return null
  }
  if (!user) {
    return <Navigate to="/login" replace />
  }
  return <Outlet />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route path="/" element={<HomePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
