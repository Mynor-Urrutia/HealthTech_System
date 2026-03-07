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
  usr_id:           number
  username:         string
  full_name:        string
  email:            string
  rol:              { rol_id: number; codigo: string; nombre: string; nivel: number }
  hospital_nombre?: string
  activo:           boolean
  cuenta_bloqueada: boolean
  ultimo_login?:    string
}

interface Hospital {
  hospital_id: number
  codigo:      string
  nombre:      string
  email?:      string
  activo:      boolean
}

interface AuditoriaItem {
  auditoria_id:      number
  tipo_evento:       string
  modulo:            string
  accion?:           string
  exitoso:           boolean
  username_intento?: string
  ip_origen?:        string
  created_at:        string
  mensaje_error?:    string
}

interface Rol {
  rol_id:  number
  codigo:  string
  nombre:  string
  nivel:   number
  activo:  boolean
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
  SUPER_ADMIN:      'bg-red-100 text-red-800',
  ADMIN_HOSPITAL:   'bg-orange-100 text-orange-800',
  MEDICO:           'bg-blue-100 text-blue-800',
  ENFERMERO:        'bg-teal-100 text-teal-800',
  FARMACEUTICO:     'bg-green-100 text-green-800',
  LABORATORISTA:    'bg-cyan-100 text-cyan-800',
  BODEGUERO:        'bg-amber-100 text-amber-800',
  ADMINISTRATIVO:   'bg-purple-100 text-purple-800',
  AUDITOR:          'bg-gray-100 text-gray-700',
}

const EVENTO_STYLE: Record<string, string> = {
  LOGIN_OK:        'bg-green-100 text-green-800',
  LOGIN_FAIL:      'bg-red-100 text-red-800',
  LOGOUT:          'bg-gray-100 text-gray-700',
  PHI_ACCESS:      'bg-blue-100 text-blue-800',
  PHI_CREATE:      'bg-indigo-100 text-indigo-800',
  PHI_UPDATE:      'bg-yellow-100 text-yellow-800',
  PHI_DELETE:      'bg-red-100 text-red-800',
  PASSWORD_CHANGE: 'bg-purple-100 text-purple-800',
  ACCOUNT_LOCKED:  'bg-red-200 text-red-900',
  ADMIN_ACTION:    'bg-orange-100 text-orange-800',
  TOKEN_REFRESH:   'bg-gray-100 text-gray-600',
  EXPORT:          'bg-teal-100 text-teal-800',
}

// ============================================================
// Main Component
// ============================================================
export default function SecurityPage() {
  const { user: authUser } = useAppSelector((s) => s.auth)
  const [tab, setTab] = useState<Tab>('usuarios')

  // ── Usuarios ──
  const [usuarios, setUsuarios]         = useState<Usuario[]>([])
  const [usuTotal, setUsuTotal]         = useState(0)
  const [usuLoading, setUsuLoading]     = useState(false)
  const [usuSearch, setUsuSearch]       = useState('')
  const [usuRolFilter, setUsuRolFilter] = useState('')
  const [roles, setRoles]               = useState<Rol[]>([])

  // ── Hospitales ──
  const [hospitales, setHospitales]     = useState<Hospital[]>([])
  const [hospLoading, setHospLoading]   = useState(false)

  // ── Auditoría ──
  const [auditoria, setAuditoria]       = useState<AuditoriaItem[]>([])
  const [audTotal, setAudTotal]         = useState(0)
  const [audLoading, setAudLoading]     = useState(false)
  const [audPage, setAudPage]           = useState(1)
  const [audEvento, setAudEvento]       = useState('')
  const [audExitoso, setAudExitoso]     = useState('')
  const [audFechaDesde, setAudFechaDesde] = useState('')
  const [audFechaHasta, setAudFechaHasta] = useState('')
  const [exporting, setExporting]       = useState(false)

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Feedback ──
  const [actionMsg, setActionMsg] = useState('')
  const [actionErr, setActionErr] = useState('')

  // ============================================================
  // Fetch functions
  // ============================================================
  const fetchUsuarios = useCallback(async () => {
    setUsuLoading(true)
    try {
      const params: Record<string, string | number> = { page_size: 20 }
      if (usuSearch)    params.search   = usuSearch
      if (usuRolFilter) params.rol      = usuRolFilter
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
      if (audEvento)     params.tipo_evento  = audEvento
      if (audExitoso)    params.exitoso      = audExitoso
      if (audFechaDesde) params.fecha_desde  = audFechaDesde
      if (audFechaHasta) params.fecha_hasta  = audFechaHasta
      const r = await api.get('/auth/auditoria/', { params })
      setAudTotal(r.data.count ?? 0)
      setAuditoria(r.data.results ?? [])
    } catch { /* ignore */ } finally { setAudLoading(false) }
  }, [audPage, audEvento, audExitoso, audFechaDesde, audFechaHasta])

  const handleExportCSV = async () => {
    setExporting(true)
    try {
      const params: Record<string, string> = {}
      if (audEvento)     params.tipo_evento  = audEvento
      if (audExitoso)    params.exitoso      = audExitoso
      if (audFechaDesde) params.fecha_desde  = audFechaDesde
      if (audFechaHasta) params.fecha_hasta  = audFechaHasta
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

  useEffect(() => { fetchRoles() }, []) // eslint-disable-line
  useEffect(() => { if (tab === 'usuarios')   fetchUsuarios() },  [tab, usuSearch, usuRolFilter]) // eslint-disable-line
  useEffect(() => { if (tab === 'hospitales') fetchHospitales() }, [tab]) // eslint-disable-line
  useEffect(() => { if (tab === 'auditoria')  fetchAuditoria() },  [tab, audPage, audEvento, audExitoso, audFechaDesde, audFechaHasta]) // eslint-disable-line

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
          { key: 'usuarios',   label: '👤 Usuarios' },
          { key: 'hospitales', label: '🏥 Hospitales' },
          { key: 'auditoria',  label: '🔍 Auditoría HIPAA' },
        ] as { key: Tab; label: string }[]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
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

      {/* ══════════════ HOSPITALES ══════════════ */}
      {tab === 'hospitales' && (
        <div className="flex-1 overflow-auto">
          {hospLoading ? (
            <div className="text-center py-16 text-gray-400 text-sm">Cargando...</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {hospitales.length === 0 ? (
                <p className="text-gray-400 text-sm col-span-full text-center py-10">Sin hospitales registrados</p>
              ) : hospitales.map(h => (
                <div key={h.hospital_id}
                  className={`bg-white rounded-xl border p-4 ${h.activo ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <p className="font-semibold text-gray-900">{h.nombre}</p>
                      <p className="text-xs text-gray-500 mt-0.5">Código: {h.codigo}</p>
                    </div>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full flex-shrink-0 ${h.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {h.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                  {h.email && (
                    <p className="text-xs text-gray-500">📧 {h.email}</p>
                  )}
                  <p className="mt-2 text-xs text-gray-400">ID: {h.hospital_id}</p>
                </div>
              ))}
            </div>
          )}
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
              {['LOGIN_OK','LOGIN_FAIL','LOGOUT','PHI_ACCESS','PHI_CREATE','PHI_UPDATE',
                'PHI_DELETE','PASSWORD_CHANGE','ACCOUNT_LOCKED','ADMIN_ACTION','EXPORT','TOKEN_REFRESH'].map(e => (
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
    </div>
  )
}
