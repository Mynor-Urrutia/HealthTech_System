import { Menu, LogOut, User, Bell } from 'lucide-react'
import { useAppDispatch, useAppSelector } from '@shared/hooks/useStore'
import { logout } from '@store/authSlice'
import { useNavigate } from 'react-router-dom'
import api from '@services/api'
import toast from 'react-hot-toast'

interface TopBarProps {
  onMenuClick: () => void
}

export default function TopBar({ onMenuClick }: TopBarProps) {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { user } = useAppSelector((s) => s.auth)
  const refreshToken = useAppSelector((s) => s.auth.refreshToken)

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout/', { refresh: refreshToken })
    } catch {
      // Si falla el logout en el backend, igual limpiar el estado
    } finally {
      dispatch(logout())
      navigate('/login', { replace: true })
      toast.success('Sesión cerrada correctamente')
    }
  }

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 flex-shrink-0">
      {/* Botón menú */}
      <button
        onClick={onMenuClick}
        className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Derecha: notificaciones + perfil + logout */}
      <div className="flex items-center gap-2">
        {/* Notificaciones */}
        <button className="relative p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
        </button>

        {/* Info del usuario */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-200">
          <div className="w-7 h-7 rounded-full bg-primary-500 flex items-center justify-center text-white text-xs font-bold">
            {user?.full_name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate max-w-[140px]">
              {user?.full_name}
            </p>
            <p className="text-xs text-gray-500 truncate">{user?.rol_nombre}</p>
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          title="Cerrar sesión"
          className="p-2 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 transition"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </header>
  )
}
