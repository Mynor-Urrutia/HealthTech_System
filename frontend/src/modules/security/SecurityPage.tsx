/**
 * HealthTech Solutions — Seguridad & Administración (Fase 12)
 * Usuarios · Hospitales · Auditoría HIPAA
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import api from '../../services/api'
import { useAppSelector } from '../../shared/hooks/useStore'

// ============================================================
// Types
// ============================================================
interface Usuario {
  usr_id: number
  username: string
  full_name: string
  email: string
  rol: { rol_id: number; codigo: string; nombre: string; nivel: number }
  hospital_nombre?: string
  activo: boolean
  cuenta_bloqueada: boolean
  ultimo_login?: string
}

interface Hospital {
  hospital_id: number
  codigo: string
  nombre: string
  nombre_corto?: string
  direccion?: string
  telefono?: string
  email?: string
  timezone?: string
  activo: boolean
}

interface AuditoriaItem {
  auditoria_id: number
  tipo_evento: string
  modulo: string
  accion?: string
  exitoso: boolean
  username_intento?: string
  ip_origen?: string
  created_at: string
  mensaje_error?: string
}

interface Rol {
  rol_id: number
  codigo: string
  nombre: string
  nivel: number
  activo: boolean
}

type Tab = 'usuarios' | 'hospitales' | 'auditoria'

// ============================================================
// Helpers
// ============================================================
function fmtDate(dt: string): string {
  if (!dt) return '—'
  return new Date(dt).toLocaleString('es-GT', { dateStyle: 'short', timeStyle: 'short' })
}

const ROL_STYLE: Record<string, string> = {
  SUPER_ADMIN: 'bg-red-100 text-red-800',
  ADMIN_HOSPITAL: 'bg-orange-100 text-orange-800',
  MEDICO: 'bg-blue-100 text-blue-800',
  ENFERMERO: 'bg-teal-100 text-teal-800',
  FARMACEUTICO: 'bg-green-100 text-green-800',
  LABORATORISTA: 'bg-cyan-100 text-cyan-800',
  BODEGUERO: 'bg-amber-100 text-amber-800',
  ADMINISTRATIVO: 'bg-purple-100 text-purple-800',
  AUDITOR: 'bg-gray-100 text-gray-700',
}

const EVENTO_STYLE: Record<string, string> = {
  LOGIN_OK: 'bg-green-100 text-green-800',
  LOGIN_FAIL: 'bg-red-100 text-red-800',
  LOGOUT: 'bg-gray-100 text-gray-700',
  PHI_ACCESS: 'bg-blue-100 text-blue-800',
  PHI_CREATE: 'bg-indigo-100 text-indigo-800',
  PHI_UPDATE: 'bg-yellow-100 text-yellow-800',
  PHI_DELETE: 'bg-red-100 text-red-800',
  PASSWORD_CHANGE: 'bg-purple-100 text-purple-800',
  ACCOUNT_LOCKED: 'bg-red-200 text-red-900',
  ADMIN_ACTION: 'bg-orange-100 text-orange-800',
  TOKEN_REFRESH: 'bg-gray-100 text-gray-600',
  EXPORT: 'bg-teal-100 text-teal-800',
}

// ============================================================
// Main Component
// ============================================================
export default function SecurityPage() {
  const { user: authUser } = useAppSelector((s) => s.auth)
  const [tab, setTab] = useState<Tab>('usuarios')

  // ── Usuarios ──
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [usuTotal, setUsuTotal] = useState(0)
  const [usuLoading, setUsuLoading] = useState(false)
  const [usuSearch, setUsuSearch] = useState('')
  const [usuRolFilter, setUsuRolFilter] = useState('')
  const [roles, setRoles] = useState<Rol[]>([])

  // ── Hospitales ──
  const [hospitales, setHospitales] = useState<Hospital[]>([])
  const [hospLoading, setHospLoading] = useState(false)
  const [selectedHosp, setSelectedHosp] = useState<Hospital | null>(null)

  // ── Modal Crear/Editar Hospital ──
  const FORM_HOSP_INIT = {
    codigo: '', nombre: '', nombre_corto: '', direccion: '',
    telefono: '', email: '', timezone: 'America/Guatemala',
  }
  const [showCrearHosp, setShowCrearHosp] = useState(false)
  const [showEditarHosp, setShowEditarHosp] = useState(false)
  const [formHosp, setFormHosp] = useState(FORM_HOSP_INIT)
  const [hospFormLoading, setHospFormLoading] = useState(false)
  const [hospFormError, setHospFormError] = useState('')

  // ── Auditoría ──
  const [auditoria, setAuditoria] = useState<AuditoriaItem[]>([])
  const [audTotal, setAudTotal] = useState(0)
  const [audLoading, setAudLoading] = useState(false)
  const [audPage, setAudPage] = useState(1)
  const [audEvento, setAudEvento] = useState('')
  const [audExitoso, setAudExitoso] = useState('')
  const [audFechaDesde, setAudFechaDesde] = useState('')
  const [audFechaHasta, setAudFechaHasta] = useState('')
  const [exporting, setExporting] = useState(false)

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Feedback ──
  const [actionMsg, setActionMsg] = useState('')
  const [actionErr, setActionErr] = useState('')

  // ── Modal Crear Usuario ──
  const FORM_CREAR_INIT = {
    username: '', password: '', primer_nombre: '', segundo_nombre: '',
    primer_apellido: '', segundo_apellido: '', email: '', telefono: '',
    tipo_personal: 'MEDICO', especialidad: '', no_colegiado: '', rol_id: '',
    hospital_id: '',
  }
  const [showCrear, setShowCrear] = useState(false)
  const [formCrear, setFormCrear] = useState(FORM_CREAR_INIT)
  const [crearLoading, setCrearLoading] = useState(false)
  const [crearError, setCrearError] = useState('')

  // ── Modal Editar Usuario ──
  const [showEditar, setShowEditar] = useState(false)
  const [editUser, setEditUser] = useState<Usuario | null>(null)
  const [formEditar, setFormEditar] = useState({
    primer_nombre: '', segundo_nombre: '', primer_apellido: '', segundo_apellido: '',
    email: '', telefono: '', tipo_personal: '', especialidad: '', no_colegiado: '', rol_id: '',
    hospital_id: '',
  })
  const [editarLoading, setEditarLoading] = useState(false)
  const [editarError, setEditarError] = useState('')

  // ============================================================
  // Fetch functions
  // ============================================================
  const fetchUsuarios = useCallback(async () => {
    setUsuLoading(true)
    try {
      const params: Record<string, string | number> = { page_size: 20 }
      if (usuSearch) params.search = usuSearch
      if (usuRolFilter) params.rol = usuRolFilter
      const r = await api.get('/auth/usuarios/', { params })
      setUsuTotal(r.data.count ?? 0)
      setUsuarios(r.data.results ?? [])
    } catch { /* ignore */ } finally { setUsuLoading(false) }
  }, [usuSearch, usuRolFilter])

  const fetchRoles = useCallback(async () => {
    try {
      const r = await api.get('/auth/roles/', { params: { page_size: 50 } })
      setRoles(r.data.results ?? [])
    } catch { /* ignore */ }
  }, [])

  const fetchHospitales = useCallback(async () => {
    setHospLoading(true)
    try {
      const r = await api.get('/auth/hospitales/', { params: { page_size: 50 } })
      setHospitales(r.data.results ?? [])
    } catch { /* ignore */ } finally { setHospLoading(false) }
  }, [])

  const fetchAuditoria = useCallback(async () => {
    setAudLoading(true)
    try {
      const params: Record<string, string | number> = { page_size: 20, page: audPage }
      if (audEvento) params.tipo_evento = audEvento
      if (audExitoso) params.exitoso = audExitoso
      if (audFechaDesde) params.fecha_desde = audFechaDesde
      if (audFechaHasta) params.fecha_hasta = audFechaHasta
      const r = await api.get('/auth/auditoria/', { params })
      setAudTotal(r.data.count ?? 0)
      setAuditoria(r.data.results ?? [])
    } catch { /* ignore */ } finally { setAudLoading(false) }
  }, [audPage, audEvento, audExitoso, audFechaDesde, audFechaHasta])

  const handleExportCSV = async () => {
    setExporting(true)
    try {
      const params: Record<string, string> = {}
      if (audEvento) params.tipo_evento = audEvento
      if (audExitoso) params.exitoso = audExitoso
      if (audFechaDesde) params.fecha_desde = audFechaDesde
      if (audFechaHasta) params.fecha_hasta = audFechaHasta
      // Use axios to get the blob with auth headers
      const r = await api.get('/auth/auditoria/reporte/', {
        params,
        responseType: 'blob',
      })
      const url = window.URL.createObjectURL(new Blob([r.data]))
      const link = document.createElement('a')
      link.href = url
      const desde = audFechaDesde || 'inicio'
      const hasta = audFechaHasta || 'hoy'
      link.setAttribute('download', `auditoria_hipaa_${desde}_a_${hasta}.csv`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch { /* ignore */ } finally {
      setExporting(false)
    }
  }

  useEffect(() => { fetchRoles(); fetchHospitales() }, []) // eslint-disable-line
  useEffect(() => { if (tab === 'usuarios') fetchUsuarios() }, [tab, usuSearch, usuRolFilter]) // eslint-disable-line
  useEffect(() => { if (tab === 'auditoria') fetchAuditoria() }, [tab, audPage, audEvento, audExitoso, audFechaDesde, audFechaHasta]) // eslint-disable-line

  // ── Debounce search ──
  function handleUsuSearch(val: string) {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => setUsuSearch(val), 400)
  }

  // ── Actions ──
  async function handleDesbloquear(userId: number, username: string) {
    setActionMsg(''); setActionErr('')
    try {
      await api.post(`/auth/usuarios/${userId}/desbloquear/`)
      setActionMsg(`Usuario "${username}" desbloqueado correctamente.`)
      fetchUsuarios()
    } catch { setActionErr('Error al desbloquear usuario.') }
  }

  async function handleDesactivar(userId: number, username: string, activo: boolean) {
    setActionMsg(''); setActionErr('')
    try {
      await api.post(`/auth/usuarios/${userId}/desactivar/`)
      setActionMsg(`Usuario "${username}" ${activo ? 'desactivado' : 'activado'}.`)
      fetchUsuarios()
    } catch { setActionErr('Error al cambiar estado del usuario.') }
  }

  // ── Crear Usuario ──
  async function handleCrearUsuario(e: React.FormEvent) {
    e.preventDefault()
    setCrearLoading(true); setCrearError('')
    try {
      await api.post('/auth/usuarios/', {
        ...formCrear,
        rol_id: parseInt(formCrear.rol_id),
        hospital_id: formCrear.hospital_id ? parseInt(formCrear.hospital_id) : undefined,
      })
      setShowCrear(false)
      setFormCrear(FORM_CREAR_INIT)
      setActionMsg('Usuario creado exitosamente.')
      fetchUsuarios()
    } catch (err: unknown) {
      const e = err as { response?: { data?: Record<string, unknown> } }
      const data = e.response?.data
      if (data && typeof data === 'object') {
        const msgs = Object.entries(data)
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : String(v)}`)
          .join(' · ')
        setCrearError(msgs)
      } else {
        setCrearError('Error al crear usuario.')
      }
    } finally { setCrearLoading(false) }
  }

  // ── Abrir modal Editar ──
  async function openEditar(userId: number) {
    setEditarError(''); setEditarLoading(false)
    try {
      const r = await api.get(`/auth/usuarios/${userId}/`)
      const u = r.data
      setEditUser(u)
      setFormEditar({
        primer_nombre: u.primer_nombre || '',
        segundo_nombre: u.segundo_nombre || '',
        primer_apellido: u.primer_apellido || '',
        segundo_apellido: u.segundo_apellido || '',
        email: u.email || '',
        telefono: u.telefono || '',
        tipo_personal: u.tipo_personal || '',
        especialidad: u.especialidad || '',
        no_colegiado: u.no_colegiado || '',
        rol_id: String(u.rol?.rol_id || ''),
        hospital_id: String(u.hospital_id || ''),
      })
      setShowEditar(true)
    } catch { setActionErr('Error al cargar datos del usuario.') }
  }

  // ── Guardar edición ──
  async function handleEditarUsuario(e: React.FormEvent) {
    e.preventDefault()
    if (!editUser) return
    setEditarLoading(true); setEditarError('')
    try {
      await api.patch(`/auth/usuarios/${editUser.usr_id}/`, {
        ...formEditar,
        rol_id: parseInt(formEditar.rol_id),
        hospital_id: formEditar.hospital_id ? parseInt(formEditar.hospital_id) : undefined,
      })
      setShowEditar(false)
      setEditUser(null)
      setActionMsg('Usuario actualizado exitosamente.')
      fetchUsuarios()
    } catch (err: unknown) {
      const e = err as { response?: { data?: Record<string, unknown> } }
      const data = e.response?.data
      if (data && typeof data === 'object') {
        const msgs = Object.entries(data)
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : String(v)}`)
          .join(' · ')
        setEditarError(msgs)
      } else {
        setEditarError('Error al actualizar usuario.')
      }
    } finally { setEditarLoading(false) }
  }

  const isSuperAdmin = authUser?.rol === 'SUPER_ADMIN'

  // ============================================================
  // JSX
  // ============================================================
  return (
    <div className="h-full flex flex-col">

      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Seguridad y Administración</h1>
        <p className="text-sm text-gray-500">Usuarios · Hospitales · Auditoría HIPAA</p>
      </div>

      {/* Feedback */}
      {actionMsg && (
        <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 flex items-center justify-between">
          {actionMsg}
          <button onClick={() => setActionMsg('')} className="text-green-500 hover:text-green-700">✕</button>
        </div>
      )}
      {actionErr && (
        <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center justify-between">
          {actionErr}
          <button onClick={() => setActionErr('')} className="text-red-500 hover:text-red-700">✕</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-4">
        {([
          { key: 'usuarios', label: '👤 Usuarios' },
          { key: 'hospitales', label: '🏥 Hospitales' },
          { key: 'auditoria', label: '🔍 Auditoría HIPAA' },
        ] as { key: Tab; label: string }[]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ══════════════ USUARIOS ══════════════ */}
      {tab === 'usuarios' && (
        <div className="flex-1 flex flex-col gap-3 min-h-0">
          {/* Filters */}
          <div className="flex gap-3 flex-wrap">
            <input type="text" placeholder="Buscar usuario, nombre, email..."
              onChange={e => handleUsuSearch(e.target.value)}
              className="flex-1 min-w-48 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <select value={usuRolFilter} onChange={e => setUsuRolFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none">
              <option value="">Todos los roles</option>
              {roles.map(r => <option key={r.rol_id} value={r.codigo}>{r.nombre}</option>)}
            </select>
            <span className="self-center text-sm text-gray-500">{usuTotal} usuario{usuTotal !== 1 ? 's' : ''}</span>
            {isSuperAdmin && (
              <button
                onClick={() => { setFormCrear(FORM_CREAR_INIT); setCrearError(''); setShowCrear(true) }}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <span className="text-lg leading-none">+</span> Nuevo Usuario
              </button>
            )}
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto bg-white rounded-xl border border-gray-200">
            {usuLoading ? (
              <div className="flex items-center justify-center py-16 text-gray-400 text-sm">Cargando...</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Usuario</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Rol</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide hidden md:table-cell">Hospital</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide hidden lg:table-cell">Último acceso</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Estado</th>
                    {isSuperAdmin && (
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Acciones</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {usuarios.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-10 text-gray-400">Sin resultados</td></tr>
                  ) : usuarios.map(u => (
                    <tr key={u.usr_id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold text-gray-600 flex-shrink-0">
                            {(u.full_name || u.username).charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{u.full_name || u.username}</p>
                            <p className="text-xs text-gray-500">@{u.username} · {u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${ROL_STYLE[u.rol?.codigo] ?? 'bg-gray-100 text-gray-700'}`}>
                          {u.rol?.nombre}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-gray-600 text-xs">
                        {u.hospital_nombre || '—'}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-gray-500 text-xs">
                        {u.ultimo_login ? fmtDate(u.ultimo_login) : 'Nunca'}
                      </td>
                      <td className="px-4 py-3">
                        {u.cuenta_bloqueada ? (
                          <span className="px-2 py-0.5 text-xs font-bold bg-red-100 text-red-800 rounded-full">🔒 Bloqueado</span>
                        ) : u.activo ? (
                          <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded-full">Activo</span>
                        ) : (
                          <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">Inactivo</span>
                        )}
                      </td>
                      {isSuperAdmin && (
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button onClick={() => openEditar(u.usr_id)}
                              className="px-2 py-1 text-xs bg-amber-50 text-amber-700 rounded hover:bg-amber-100 font-medium">
                              ✏ Editar
                            </button>
                            {u.cuenta_bloqueada && (
                              <button onClick={() => handleDesbloquear(u.usr_id, u.username)}
                                className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700">
                                Desbloquear
                              </button>
                            )}
                            <button onClick={() => handleDesactivar(u.usr_id, u.username, u.activo)}
                              className={`px-2 py-1 text-xs rounded ${u.activo ? 'bg-red-50 text-red-700 hover:bg-red-100' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}>
                              {u.activo ? 'Desactivar' : 'Activar'}
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ════════════ HOSPITALES ════════════ */}
      {tab === 'hospitales' && (
        <div className="flex-1 flex flex-col gap-3 min-h-0">
          {/* Header con botón crear */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">{hospitales.length} hospital{hospitales.length !== 1 ? 'es' : ''} registrado{hospitales.length !== 1 ? 's' : ''}</span>
            {isSuperAdmin && (
              <button
                onClick={() => { setFormHosp(FORM_HOSP_INIT); setHospFormError(''); setShowCrearHosp(true) }}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <span className="text-lg leading-none">+</span> Nuevo Hospital
              </button>
            )}
          </div>

          <div className="flex-1 overflow-auto flex gap-4">
            {/* Grid de cards */}
            <div className={`overflow-auto ${selectedHosp ? 'w-1/2' : 'w-full'}`}>
              {hospLoading ? (
                <div className="text-center py-16 text-gray-400 text-sm">Cargando...</div>
              ) : (
                <div className={`grid gap-4 ${selectedHosp ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}`}>
                  {hospitales.length === 0 ? (
                    <p className="text-gray-400 text-sm col-span-full text-center py-10">Sin hospitales registrados</p>
                  ) : hospitales.map(h => (
                    <div key={h.hospital_id}
                      onClick={() => setSelectedHosp(selectedHosp?.hospital_id === h.hospital_id ? null : h)}
                      className={`bg-white rounded-xl border p-4 cursor-pointer transition-all hover:shadow-md ${selectedHosp?.hospital_id === h.hospital_id
                        ? 'border-blue-500 ring-2 ring-blue-100'
                        : h.activo ? 'border-gray-200' : 'border-gray-100 opacity-60'
                        }`}>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <p className="font-semibold text-gray-900">{h.nombre}</p>
                          <p className="text-xs text-gray-500 mt-0.5">Código: {h.codigo}</p>
                        </div>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full flex-shrink-0 ${h.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {h.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </div>
                      {h.email && <p className="text-xs text-gray-500">📧 {h.email}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Panel de detalle */}
            {selectedHosp && (
              <div className="w-1/2 bg-white rounded-xl border border-gray-200 p-6 overflow-auto">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{selectedHosp.nombre}</h3>
                    <p className="text-sm text-gray-500">ID: {selectedHosp.hospital_id} · Código: {selectedHosp.codigo}</p>
                  </div>
                  <button onClick={() => setSelectedHosp(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
                </div>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><span className="font-medium text-gray-600">Nombre Corto:</span><p className="text-gray-900">{selectedHosp.nombre_corto || '—'}</p></div>
                    <div><span className="font-medium text-gray-600">Estado:</span><p>{selectedHosp.activo ? <span className="text-green-600 font-medium">Activo</span> : <span className="text-gray-400">Inactivo</span>}</p></div>
                    <div><span className="font-medium text-gray-600">Dirección:</span><p className="text-gray-900">{selectedHosp.direccion || '—'}</p></div>
                    <div><span className="font-medium text-gray-600">Teléfono:</span><p className="text-gray-900">{selectedHosp.telefono || '—'}</p></div>
                    <div><span className="font-medium text-gray-600">Email:</span><p className="text-gray-900">{selectedHosp.email || '—'}</p></div>
                    <div><span className="font-medium text-gray-600">Zona Horaria:</span><p className="text-gray-900">{selectedHosp.timezone || '—'}</p></div>
                  </div>
                  {isSuperAdmin && (
                    <div className="flex gap-2 pt-3 border-t border-gray-100">
                      <button
                        onClick={() => {
                          setFormHosp({
                            codigo: selectedHosp.codigo || '',
                            nombre: selectedHosp.nombre || '',
                            nombre_corto: selectedHosp.nombre_corto || '',
                            direccion: selectedHosp.direccion || '',
                            telefono: selectedHosp.telefono || '',
                            email: selectedHosp.email || '',
                            timezone: selectedHosp.timezone || 'America/Guatemala',
                          })
                          setHospFormError('')
                          setShowEditarHosp(true)
                        }}
                        className="px-3 py-1.5 text-xs font-medium bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100"
                      >✏ Editar</button>
                      <button
                        onClick={async () => {
                          if (!confirm(`¿Desactivar el hospital "${selectedHosp.nombre}"?`)) return
                          try {
                            await api.delete(`/auth/hospitales/${selectedHosp.hospital_id}/`)
                            setActionMsg(`Hospital "${selectedHosp.nombre}" desactivado.`)
                            setSelectedHosp(null)
                            fetchHospitales()
                          } catch { setActionErr('Error al desactivar hospital.') }
                        }}
                        className="px-3 py-1.5 text-xs font-medium bg-red-50 text-red-700 rounded-lg hover:bg-red-100"
                      >Desactivar</button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════ AUDITORÍA ══════════════ */}
      {tab === 'auditoria' && (
        <div className="flex-1 flex flex-col gap-3 min-h-0">
          {/* Filters */}
          <div className="flex gap-2 flex-wrap items-center">
            {/* Fecha desde / hasta */}
            <input type="date" value={audFechaDesde}
              onChange={e => { setAudFechaDesde(e.target.value); setAudPage(1) }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none"
              title="Fecha desde"
            />
            <span className="text-gray-400 text-xs">→</span>
            <input type="date" value={audFechaHasta}
              onChange={e => { setAudFechaHasta(e.target.value); setAudPage(1) }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none"
              title="Fecha hasta"
            />
            <select value={audEvento} onChange={e => { setAudEvento(e.target.value); setAudPage(1) }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none">
              <option value="">Todos los eventos</option>
              {['LOGIN_OK', 'LOGIN_FAIL', 'LOGOUT', 'PHI_ACCESS', 'PHI_CREATE', 'PHI_UPDATE',
                'PHI_DELETE', 'PASSWORD_CHANGE', 'ACCOUNT_LOCKED', 'ADMIN_ACTION', 'EXPORT', 'TOKEN_REFRESH'].map(e => (
                  <option key={e} value={e}>{e.replace(/_/g, ' ')}</option>
                ))}
            </select>
            <select value={audExitoso} onChange={e => { setAudExitoso(e.target.value); setAudPage(1) }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none">
              <option value="">Todos</option>
              <option value="true">Exitosos</option>
              <option value="false">Fallidos</option>
            </select>
            <span className="text-xs text-gray-500 flex-1">{audTotal} registro{audTotal !== 1 ? 's' : ''}</span>
            {/* Exportar CSV */}
            <button
              onClick={handleExportCSV}
              disabled={exporting}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-teal-600 text-white text-xs font-medium hover:bg-teal-700 disabled:opacity-50"
              title="Exportar auditoría HIPAA a CSV"
            >
              {exporting ? '⏳' : '⬇️'} Exportar CSV
            </button>
            {/* Paginación */}
            <div className="flex gap-1">
              <button onClick={() => setAudPage(p => Math.max(1, p - 1))} disabled={audPage === 1}
                className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40">
                ← Anterior
              </button>
              <span className="px-3 py-1.5 text-xs text-gray-600">Pág. {audPage}</span>
              <button onClick={() => setAudPage(p => p + 1)} disabled={audPage * 20 >= audTotal}
                className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40">
                Siguiente →
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto bg-white rounded-xl border border-gray-200">
            {audLoading ? (
              <div className="flex items-center justify-center py-16 text-gray-400 text-sm">Cargando...</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Fecha</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Evento</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide hidden md:table-cell">Módulo / Acción</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide hidden lg:table-cell">Usuario</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide hidden lg:table-cell">IP</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Resultado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {auditoria.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-10 text-gray-400">Sin registros</td></tr>
                  ) : auditoria.map(a => (
                    <tr key={a.auditoria_id} className={`hover:bg-gray-50 transition-colors ${!a.exitoso ? 'bg-red-50/30' : ''}`}>
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                        {fmtDate(a.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${EVENTO_STYLE[a.tipo_evento] ?? 'bg-gray-100 text-gray-700'}`}>
                          {a.tipo_evento.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-xs text-gray-600">
                        <span className="font-medium">{a.modulo}</span>
                        {a.accion && <span className="text-gray-400"> · {a.accion}</span>}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-xs text-gray-600">
                        {a.username_intento || '—'}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-xs text-gray-400 font-mono">
                        {a.ip_origen || '—'}
                      </td>
                      <td className="px-4 py-3">
                        {a.exitoso ? (
                          <span className="text-green-600 text-xs font-medium">✓ OK</span>
                        ) : (
                          <span className="text-red-600 text-xs font-medium" title={a.mensaje_error || ''}>✗ Fallido</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ══════════════ MODAL — Crear Usuario ══════════════ */}
      {showCrear && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">Crear Nuevo Usuario</h3>
              <button onClick={() => setShowCrear(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <form onSubmit={handleCrearUsuario} className="p-6 space-y-4">
              {crearError && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{crearError}</div>}

              {/* Credenciales */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Usuario *</label>
                  <input required value={formCrear.username}
                    onChange={e => setFormCrear(f => ({ ...f, username: e.target.value }))}
                    placeholder="nombre.apellido"
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña * <span className="text-xs text-gray-400">(mín. 10 chars)</span></label>
                  <input required type="password" minLength={10} value={formCrear.password}
                    onChange={e => setFormCrear(f => ({ ...f, password: e.target.value }))}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              {/* Nombre completo */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Primer Nombre *</label>
                  <input required value={formCrear.primer_nombre}
                    onChange={e => setFormCrear(f => ({ ...f, primer_nombre: e.target.value }))}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Segundo Nombre</label>
                  <input value={formCrear.segundo_nombre}
                    onChange={e => setFormCrear(f => ({ ...f, segundo_nombre: e.target.value }))}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Primer Apellido *</label>
                  <input required value={formCrear.primer_apellido}
                    onChange={e => setFormCrear(f => ({ ...f, primer_apellido: e.target.value }))}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Segundo Apellido</label>
                  <input value={formCrear.segundo_apellido}
                    onChange={e => setFormCrear(f => ({ ...f, segundo_apellido: e.target.value }))}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              {/* Contacto */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                  <input required type="email" value={formCrear.email}
                    onChange={e => setFormCrear(f => ({ ...f, email: e.target.value }))}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                  <input value={formCrear.telefono}
                    onChange={e => setFormCrear(f => ({ ...f, telefono: e.target.value }))}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              {/* Rol, hospital y tipo profesional */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rol *</label>
                  <select required value={formCrear.rol_id}
                    onChange={e => setFormCrear(f => ({ ...f, rol_id: e.target.value }))}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">— Seleccionar rol —</option>
                    {roles.map(r => <option key={r.rol_id} value={r.rol_id}>{r.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hospital *</label>
                  <select required value={formCrear.hospital_id}
                    onChange={e => setFormCrear(f => ({ ...f, hospital_id: e.target.value }))}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">— Seleccionar hospital —</option>
                    {hospitales.map(h => <option key={h.hospital_id} value={h.hospital_id}>{h.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo Personal *</label>
                  <select required value={formCrear.tipo_personal}
                    onChange={e => setFormCrear(f => ({ ...f, tipo_personal: e.target.value }))}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="MEDICO">Médico</option>
                    <option value="ENFERMERO">Enfermero/a</option>
                    <option value="FARMACEUTICO">Farmacéutico/a</option>
                    <option value="LABORATORISTA">Laboratorista</option>
                    <option value="BODEGUERO">Bodeguero/a</option>
                    <option value="ADMINISTRATIVO">Administrativo</option>
                    <option value="TECNICO">Técnico</option>
                    <option value="OTRO">Otro</option>
                  </select>
                </div>
              </div>

              {/* Profesional */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Especialidad</label>
                  <input value={formCrear.especialidad}
                    onChange={e => setFormCrear(f => ({ ...f, especialidad: e.target.value }))}
                    placeholder="Ej: Cardiología"
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">No. Colegiado</label>
                  <input value={formCrear.no_colegiado}
                    onChange={e => setFormCrear(f => ({ ...f, no_colegiado: e.target.value }))}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowCrear(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg">Cancelar</button>
                <button type="submit" disabled={crearLoading}
                  className="px-5 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50">
                  {crearLoading ? 'Creando...' : 'Crear Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════ MODAL — Editar Usuario ══════════════ */}
      {showEditar && editUser && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Editar Usuario</h3>
                <p className="text-xs text-gray-500">@{editUser.username} · ID: {editUser.usr_id}</p>
              </div>
              <button onClick={() => { setShowEditar(false); setEditUser(null) }} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <form onSubmit={handleEditarUsuario} className="p-6 space-y-4">
              {editarError && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{editarError}</div>}

              {/* Nombre completo */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Primer Nombre *</label>
                  <input required value={formEditar.primer_nombre}
                    onChange={e => setFormEditar(f => ({ ...f, primer_nombre: e.target.value }))}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Segundo Nombre</label>
                  <input value={formEditar.segundo_nombre}
                    onChange={e => setFormEditar(f => ({ ...f, segundo_nombre: e.target.value }))}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Primer Apellido *</label>
                  <input required value={formEditar.primer_apellido}
                    onChange={e => setFormEditar(f => ({ ...f, primer_apellido: e.target.value }))}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Segundo Apellido</label>
                  <input value={formEditar.segundo_apellido}
                    onChange={e => setFormEditar(f => ({ ...f, segundo_apellido: e.target.value }))}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              {/* Contacto */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                  <input required type="email" value={formEditar.email}
                    onChange={e => setFormEditar(f => ({ ...f, email: e.target.value }))}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                  <input value={formEditar.telefono}
                    onChange={e => setFormEditar(f => ({ ...f, telefono: e.target.value }))}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              {/* Rol, hospital y tipo profesional */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rol *</label>
                  <select required value={formEditar.rol_id}
                    onChange={e => setFormEditar(f => ({ ...f, rol_id: e.target.value }))}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">— Seleccionar rol —</option>
                    {roles.map(r => <option key={r.rol_id} value={r.rol_id}>{r.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hospital *</label>
                  <select required value={formEditar.hospital_id}
                    onChange={e => setFormEditar(f => ({ ...f, hospital_id: e.target.value }))}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">— Seleccionar hospital —</option>
                    {hospitales.map(h => <option key={h.hospital_id} value={h.hospital_id}>{h.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo Personal</label>
                  <select value={formEditar.tipo_personal}
                    onChange={e => setFormEditar(f => ({ ...f, tipo_personal: e.target.value }))}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="MEDICO">Médico</option>
                    <option value="ENFERMERO">Enfermero/a</option>
                    <option value="FARMACEUTICO">Farmacéutico/a</option>
                    <option value="LABORATORISTA">Laboratorista</option>
                    <option value="BODEGUERO">Bodeguero/a</option>
                    <option value="ADMINISTRATIVO">Administrativo</option>
                    <option value="TECNICO">Técnico</option>
                    <option value="OTRO">Otro</option>
                  </select>
                </div>
              </div>

              {/* Profesional */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Especialidad</label>
                  <input value={formEditar.especialidad}
                    onChange={e => setFormEditar(f => ({ ...f, especialidad: e.target.value }))}
                    placeholder="Ej: Cardiología"
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">No. Colegiado</label>
                  <input value={formEditar.no_colegiado}
                    onChange={e => setFormEditar(f => ({ ...f, no_colegiado: e.target.value }))}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setShowEditar(false); setEditUser(null) }}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg">Cancelar</button>
                <button type="submit" disabled={editarLoading}
                  className="px-5 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50">
                  {editarLoading ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════ MODAL — Crear Hospital ══════════════ */}
      {showCrearHosp && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">Crear Nuevo Hospital</h3>
              <button onClick={() => setShowCrearHosp(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault()
              setHospFormLoading(true); setHospFormError('')
              try {
                await api.post('/auth/hospitales/', formHosp)
                setShowCrearHosp(false)
                setActionMsg('Hospital creado exitosamente.')
                fetchHospitales()
              } catch (err: unknown) {
                const ex = err as { response?: { data?: Record<string, unknown> } }
                const data = ex.response?.data
                if (data && typeof data === 'object') {
                  setHospFormError(Object.entries(data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : String(v)}`).join(' · '))
                } else { setHospFormError('Error al crear hospital.') }
              } finally { setHospFormLoading(false) }
            }} className="p-6 space-y-4">
              {hospFormError && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{hospFormError}</div>}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Código *</label>
                  <input required value={formHosp.codigo}
                    onChange={e => setFormHosp(f => ({ ...f, codigo: e.target.value }))}
                    placeholder="HGS-01"
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Corto</label>
                  <input value={formHosp.nombre_corto}
                    onChange={e => setFormHosp(f => ({ ...f, nombre_corto: e.target.value }))}
                    placeholder="HGS"
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Completo *</label>
                <input required value={formHosp.nombre}
                  onChange={e => setFormHosp(f => ({ ...f, nombre: e.target.value }))}
                  placeholder="Hospital General San Juan de Dios"
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
                <input value={formHosp.direccion}
                  onChange={e => setFormHosp(f => ({ ...f, direccion: e.target.value }))}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                  <input value={formHosp.telefono}
                    onChange={e => setFormHosp(f => ({ ...f, telefono: e.target.value }))}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" value={formHosp.email}
                    onChange={e => setFormHosp(f => ({ ...f, email: e.target.value }))}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Zona Horaria</label>
                <select value={formHosp.timezone}
                  onChange={e => setFormHosp(f => ({ ...f, timezone: e.target.value }))}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="America/Guatemala">America/Guatemala</option>
                  <option value="America/Mexico_City">America/Mexico_City</option>
                  <option value="America/Bogota">America/Bogota</option>
                  <option value="America/Lima">America/Lima</option>
                  <option value="America/New_York">America/New_York</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowCrearHosp(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg">Cancelar</button>
                <button type="submit" disabled={hospFormLoading}
                  className="px-5 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50">
                  {hospFormLoading ? 'Creando...' : 'Crear Hospital'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════ MODAL — Editar Hospital ══════════════ */}
      {showEditarHosp && selectedHosp && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Editar Hospital</h3>
                <p className="text-xs text-gray-500">ID: {selectedHosp.hospital_id}</p>
              </div>
              <button onClick={() => setShowEditarHosp(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault()
              setHospFormLoading(true); setHospFormError('')
              try {
                const r = await api.put(`/auth/hospitales/${selectedHosp.hospital_id}/`, formHosp)
                setShowEditarHosp(false)
                setSelectedHosp(r.data)
                setActionMsg('Hospital actualizado exitosamente.')
                fetchHospitales()
              } catch (err: unknown) {
                const ex = err as { response?: { data?: Record<string, unknown> } }
                const data = ex.response?.data
                if (data && typeof data === 'object') {
                  setHospFormError(Object.entries(data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : String(v)}`).join(' · '))
                } else { setHospFormError('Error al actualizar hospital.') }
              } finally { setHospFormLoading(false) }
            }} className="p-6 space-y-4">
              {hospFormError && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{hospFormError}</div>}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Código *</label>
                  <input required value={formHosp.codigo}
                    onChange={e => setFormHosp(f => ({ ...f, codigo: e.target.value }))}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Corto</label>
                  <input value={formHosp.nombre_corto}
                    onChange={e => setFormHosp(f => ({ ...f, nombre_corto: e.target.value }))}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Completo *</label>
                <input required value={formHosp.nombre}
                  onChange={e => setFormHosp(f => ({ ...f, nombre: e.target.value }))}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
                <input value={formHosp.direccion}
                  onChange={e => setFormHosp(f => ({ ...f, direccion: e.target.value }))}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                  <input value={formHosp.telefono}
                    onChange={e => setFormHosp(f => ({ ...f, telefono: e.target.value }))}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" value={formHosp.email}
                    onChange={e => setFormHosp(f => ({ ...f, email: e.target.value }))}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Zona Horaria</label>
                <select value={formHosp.timezone}
                  onChange={e => setFormHosp(f => ({ ...f, timezone: e.target.value }))}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="America/Guatemala">America/Guatemala</option>
                  <option value="America/Mexico_City">America/Mexico_City</option>
                  <option value="America/Bogota">America/Bogota</option>
                  <option value="America/Lima">America/Lima</option>
                  <option value="America/New_York">America/New_York</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowEditarHosp(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg">Cancelar</button>
                <button type="submit" disabled={hospFormLoading}
                  className="px-5 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50">
                  {hospFormLoading ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
