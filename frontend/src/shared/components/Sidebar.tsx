import { NavLink } from 'react-router-dom'
import { useAppSelector } from '@shared/hooks/useStore'
import { clsx } from 'clsx'
import {
  LayoutDashboard, Users, Calendar, AlertTriangle,
  BedDouble, Scissors, FlaskConical, Pill,
  Package, Stethoscope, Shield, X,
} from 'lucide-react'

interface NavItem {
  label:    string
  to:       string
  icon:     React.ReactNode
  roles:    string[]   // Roles que pueden ver este ítem
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard',      to: '/dashboard',         icon: <LayoutDashboard className="w-5 h-5" />, roles: ['*'] },
  { label: 'Pacientes',      to: '/patients',          icon: <Users className="w-5 h-5" />,           roles: ['*'] },
  { label: 'Citas',          to: '/appointments',      icon: <Calendar className="w-5 h-5" />,        roles: ['SUPER_ADMIN','ADMIN_HOSPITAL','MEDICO','ADMINISTRATIVO'] },
  { label: 'Emergencias',    to: '/emergency',         icon: <AlertTriangle className="w-5 h-5" />,   roles: ['*'] },
  { label: 'Encamamiento',   to: '/hospitalization',   icon: <BedDouble className="w-5 h-5" />,       roles: ['SUPER_ADMIN','ADMIN_HOSPITAL','MEDICO','ENFERMERO'] },
  { label: 'Cirugía',        to: '/surgery',           icon: <Scissors className="w-5 h-5" />,        roles: ['SUPER_ADMIN','ADMIN_HOSPITAL','MEDICO'] },
  { label: 'Laboratorio',    to: '/laboratory',        icon: <FlaskConical className="w-5 h-5" />,    roles: ['SUPER_ADMIN','ADMIN_HOSPITAL','MEDICO','LABORATORISTA'] },
  { label: 'Farmacia',       to: '/pharmacy',          icon: <Pill className="w-5 h-5" />,            roles: ['SUPER_ADMIN','ADMIN_HOSPITAL','FARMACEUTICO','MEDICO'] },
  { label: 'Bodega',         to: '/warehouse',         icon: <Package className="w-5 h-5" />,         roles: ['SUPER_ADMIN','ADMIN_HOSPITAL','BODEGUERO'] },
  { label: 'Enfermería',     to: '/nursing',           icon: <Stethoscope className="w-5 h-5" />,     roles: ['SUPER_ADMIN','ADMIN_HOSPITAL','ENFERMERO','MEDICO'] },
  { label: 'Seguridad',      to: '/security',          icon: <Shield className="w-5 h-5" />,          roles: ['SUPER_ADMIN','ADMIN_HOSPITAL','AUDITOR'] },
]

interface SidebarProps {
  open:    boolean
  onClose: () => void
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const { user } = useAppSelector((s) => s.auth)
  const userRol  = user?.rol ?? ''

  const visibleItems = NAV_ITEMS.filter(
    (item) => item.roles.includes('*') || item.roles.includes(userRol)
  )

  return (
    <>
      {/* Overlay móvil */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-20 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed lg:static inset-y-0 left-0 z-30',
          'flex flex-col w-64 bg-primary-700 text-white',
          'transition-transform duration-300',
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0 lg:w-16',
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between h-16 px-4 bg-primary-800">
          {open && (
            <span className="font-bold text-sm tracking-wide truncate">
              HealthTech
            </span>
          )}
          <button onClick={onClose} className="lg:hidden text-white/70 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Badge del hospital */}
        {open && user && (
          <div className="mx-3 mt-3 px-3 py-2 bg-primary-600 rounded-lg">
            <p className="text-xs text-primary-200 font-medium">Hospital activo</p>
            <p className="text-sm text-white font-semibold truncate">{user.hospital_nombre}</p>
          </div>
        )}

        {/* Navegación */}
        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
          {visibleItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              title={!open ? item.label : undefined}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition',
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'text-primary-200 hover:bg-white/10 hover:text-white',
                  !open && 'justify-center',
                )
              }
            >
              {item.icon}
              {open && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Footer — info del usuario */}
        {open && user && (
          <div className="p-3 border-t border-primary-600">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-sm font-bold flex-shrink-0">
                {user.full_name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">{user.full_name}</p>
                <p className="text-xs text-primary-300 truncate">{user.rol_nombre}</p>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  )
}
