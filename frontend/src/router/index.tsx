/**
 * HealthTech Solutions — Router principal
 * Guard de autenticación: redirige a login si no hay sesión activa
 */

import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import { useAppSelector } from '@shared/hooks/useStore'
import { lazy, Suspense } from 'react'

// Layouts
const MainLayout    = lazy(() => import('@shared/layouts/MainLayout'))
const AuthLayout    = lazy(() => import('@shared/layouts/AuthLayout'))

// Auth
const LoginPage     = lazy(() => import('@modules/auth/LoginPage'))

// Dashboard
const DashboardPage = lazy(() => import('@modules/dashboard/DashboardPage'))

// Módulos clínicos (lazy load por módulo — code splitting)
const PatientsPage      = lazy(() => import('@modules/patients/PatientsPage'))
const AppointmentsPage  = lazy(() => import('@modules/appointments/AppointmentsPage'))
const EmergencyPage     = lazy(() => import('@modules/emergency/EmergencyPage'))
const HospitalizationPage = lazy(() => import('@modules/hospitalization/HospitalizationPage'))
const SurgeryPage       = lazy(() => import('@modules/surgery/SurgeryPage'))
const LaboratoryPage    = lazy(() => import('@modules/laboratory/LaboratoryPage'))
const PharmacyPage      = lazy(() => import('@modules/pharmacy/PharmacyPage'))
const WarehousePage     = lazy(() => import('@modules/warehouse/WarehousePage'))
const NursingPage       = lazy(() => import('@modules/nursing/NursingPage'))
const SecurityPage      = lazy(() => import('@modules/security/SecurityPage'))
const ImagingPage       = lazy(() => import('@modules/imaging/ImagingPage'))

// ---- Guard de autenticación ----
function AuthGuard() {
  const { user, accessToken } = useAppSelector((state) => state.auth)
  if (!user || !accessToken) {
    return <Navigate to="/login" replace />
  }
  return <Outlet />
}

// ---- Spinner de carga (mientras se carga el módulo) ----
function PageLoader() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
    </div>
  )
}

function SuspenseWrapper({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>
}

// ---- Definición del router ----
export const router = createBrowserRouter([
  // Rutas públicas
  {
    element: <SuspenseWrapper><AuthLayout /></SuspenseWrapper>,
    children: [
      { path: '/login', element: <LoginPage /> },
    ],
  },
  // Rutas protegidas
  {
    element: <AuthGuard />,
    children: [
      {
        element: <SuspenseWrapper><MainLayout /></SuspenseWrapper>,
        children: [
          { path: '/',                  element: <Navigate to="/dashboard" replace /> },
          { path: '/dashboard',         element: <DashboardPage /> },
          { path: '/patients/*',        element: <PatientsPage /> },
          { path: '/appointments/*',    element: <AppointmentsPage /> },
          { path: '/emergency/*',       element: <EmergencyPage /> },
          { path: '/hospitalization/*', element: <HospitalizationPage /> },
          { path: '/surgery/*',         element: <SurgeryPage /> },
          { path: '/laboratory/*',      element: <LaboratoryPage /> },
          { path: '/pharmacy/*',        element: <PharmacyPage /> },
          { path: '/warehouse/*',       element: <WarehousePage /> },
          { path: '/nursing/*',         element: <NursingPage /> },
          { path: '/security/*',        element: <SecurityPage /> },
          { path: '/imaging/*',         element: <ImagingPage /> },
        ],
      },
    ],
  },
  // 404
  { path: '*', element: <Navigate to="/dashboard" replace /> },
])
