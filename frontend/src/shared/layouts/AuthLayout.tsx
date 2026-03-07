import { Outlet, Navigate } from 'react-router-dom'
import { useAppSelector } from '@shared/hooks/useStore'

export default function AuthLayout() {
  const { user, accessToken } = useAppSelector((s) => s.auth)

  // Si ya hay sesión activa, redirigir al dashboard
  if (user && accessToken) return <Navigate to="/dashboard" replace />

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-700 via-primary-600 to-primary-500 flex items-center justify-center p-4">
      {/* Fondo decorativo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-white/5 rounded-full" />
        <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-white/5 rounded-full" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo y nombre del sistema */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl shadow-lg mb-4">
            <svg className="w-9 h-9 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">HealthTech Solutions</h1>
          <p className="text-primary-200 text-sm mt-1">Sistema de Gestión Hospitalaria</p>
        </div>

        {/* Contenido de la ruta (LoginPage) */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <Outlet />
        </div>

        {/* Footer */}
        <p className="text-center text-primary-200 text-xs mt-6">
          © {new Date().getFullYear()} HealthTech Solutions · Acceso restringido
        </p>
      </div>
    </div>
  )
}
