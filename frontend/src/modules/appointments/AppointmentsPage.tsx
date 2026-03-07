/**
 * HealthTech Solutions — AppointmentsPage (M03)
 * Agenda de citas médicas con HIPAA compliance:
 *   - Listado paginado con filtros de fecha, estado y búsqueda
 *   - Panel de detalle con máquina de estados (confirmar / cancelar / completar)
 *   - Modal de registro de nueva cita con búsqueda de paciente y médico
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '@services/api'
import { clsx } from 'clsx'
import {
  Search, Plus, X, Calendar, Clock, User, RefreshCw,
  ChevronRight, CheckCircle, XCircle, PlayCircle,
  AlertTriangle, ClipboardList, Stethoscope, FileText,
  ChevronDown,
} from 'lucide-react'

// ────────────────────────────────────────────────────────────
// Tipos
// ────────────────────────────────────────────────────────────
interface Cita {
  cit_id: number
  fecha_cita: string
  hora_inicio: string
  hora_inicio_fmt: string
  hora_fin_fmt: string
  duracion_min: number
  tipo_cita: string
  tipo_cita_display: string
  motivo: string
  estado: EstadoCita
  estado_display: string
  prioridad: string
  prioridad_display: string
  sala: string
  paciente_nombre: string
  paciente_expediente: string
  medico_nombre: string
  activo: boolean
}

interface CitaDetalle extends Cita {
  hospital_id: number
  notas_medico: string
  notas_admin: string
  motivo_cancelacion: string
  cancelada_por_nombre: string | null
  cancelada_en: string | null
  created_at: string
  updated_at: string
}

type EstadoCita = 'PROGRAMADA' | 'CONFIRMADA' | 'EN_PROGRESO' | 'COMPLETADA' | 'CANCELADA' | 'NO_ASISTIO'

interface PaginatedResponse {
  count: number
  next: string | null
  previous: string | null
  results: Cita[]
}

interface PacienteBusqueda {
  pac_id: number
  nombre_completo: string
  no_expediente: string
  no_documento: string
}

interface MedicoBusqueda {
  usr_id: number
  primer_nombre: string
  primer_apellido: string
}

// Estado inicial del formulario de nueva cita
const FORM_INICIAL = {
  paciente:     null as number | null,
  medico:       null as number | null,
  fecha_cita:   '',
  hora_inicio:  '',
  hora_fin:     '',
  duracion_min: 30,
  tipo_cita:    'CONSULTA',
  motivo:       '',
  prioridad:    'NORMAL',
  sala:         '',
  notas_admin:  '',
}

// ── Colores por estado ──────────────────────────────────────
const ESTADO_COLORS: Record<EstadoCita, string> = {
  PROGRAMADA:  'bg-blue-100 text-blue-800',
  CONFIRMADA:  'bg-teal-100 text-teal-800',
  EN_PROGRESO: 'bg-yellow-100 text-yellow-800',
  COMPLETADA:  'bg-green-100 text-green-800',
  CANCELADA:   'bg-red-100 text-red-800',
  NO_ASISTIO:  'bg-gray-100 text-gray-600',
}

const ESTADO_DOT: Record<EstadoCita, string> = {
  PROGRAMADA:  'bg-blue-500',
  CONFIRMADA:  'bg-teal-500',
  EN_PROGRESO: 'bg-yellow-500',
  COMPLETADA:  'bg-green-500',
  CANCELADA:   'bg-red-500',
  NO_ASISTIO:  'bg-gray-400',
}

// Pestañas de fecha rápida
type TabFecha = 'hoy' | 'semana' | 'mes' | 'todas'

function getFechaRange(tab: TabFecha): { fecha_desde?: string; fecha_hasta?: string } {
  const hoy = new Date()
  const fmt  = (d: Date) => d.toISOString().slice(0, 10)

  if (tab === 'hoy')    return { fecha_desde: fmt(hoy), fecha_hasta: fmt(hoy) }
  if (tab === 'semana') {
    const lunes   = new Date(hoy); lunes.setDate(hoy.getDate() - hoy.getDay() + 1)
    const domingo = new Date(lunes); domingo.setDate(lunes.getDate() + 6)
    return { fecha_desde: fmt(lunes), fecha_hasta: fmt(domingo) }
  }
  if (tab === 'mes') {
    const ini = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
    const fin = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)
    return { fecha_desde: fmt(ini), fecha_hasta: fmt(fin) }
  }
  return {}
}

// ════════════════════════════════════════════════════════════
// Componente principal
// ════════════════════════════════════════════════════════════
export default function AppointmentsPage() {
  // Lista
  const [citas,        setCitas]        = useState<Cita[]>([])
  const [total,        setTotal]        = useState(0)
  const [hasMore,      setHasMore]      = useState(false)
  const [page,         setPage]         = useState(1)
  const [search,       setSearch]       = useState('')
  const [tabFecha,     setTabFecha]     = useState<TabFecha>('hoy')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [loading,      setLoading]      = useState(true)
  const [listError,    setListError]    = useState('')

  // Detalle
  const [selected,   setSelected]   = useState<CitaDetalle | null>(null)
  const [detailLoad, setDetailLoad] = useState(false)

  // Acciones de estado
  const [accionando,         setAccionando]         = useState(false)
  const [showCancelarModal,  setShowCancelarModal]  = useState(false)
  const [motivoCancel,       setMotivoCancel]       = useState('')
  const [notasCompletar,     setNotasCompletar]     = useState('')
  const [showCompletarModal, setShowCompletarModal] = useState(false)
  const [accionError,        setAccionError]        = useState('')

  // Modal crear
  const [showModal, setShowModal] = useState(false)
  const [form,      setForm]      = useState<typeof FORM_INICIAL>(FORM_INICIAL)
  const [saving,    setSaving]    = useState(false)
  const [formError, setFormError] = useState('')

  // Búsqueda paciente en modal
  const [pacSearch,   setPacSearch]   = useState('')
  const [pacResults,  setPacResults]  = useState<PacienteBusqueda[]>([])
  const [pacSelected, setPacSelected] = useState<PacienteBusqueda | null>(null)
  const [pacLoading,  setPacLoading]  = useState(false)
  const [showPacDrop, setShowPacDrop] = useState(false)

  // Lista de médicos
  const [medicos, setMedicos] = useState<MedicoBusqueda[]>([])

  const searchTimer    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pacSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Cargar lista de citas ──────────────────────────────────
  const fetchCitas = useCallback(async (
    q: string, pg: number, tab: TabFecha, estado: string,
  ) => {
    setLoading(true)
    setListError('')
    try {
      const params = new URLSearchParams({ page: String(pg), page_size: '25' })
      if (q)      params.set('search', q)
      if (estado) params.set('estado', estado)
      const range = getFechaRange(tab)
      if (range.fecha_desde) params.set('fecha_desde', range.fecha_desde)
      if (range.fecha_hasta) params.set('fecha_hasta', range.fecha_hasta)

      const { data } = await api.get<PaginatedResponse>(`/appointments/?${params}`)
      setCitas(prev => pg === 1 ? data.results : [...prev, ...data.results])
      setTotal(data.count)
      setHasMore(!!data.next)
    } catch {
      setListError('No se pudo conectar con el servidor.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCitas('', 1, tabFecha, filtroEstado)
  }, [fetchCitas, tabFecha, filtroEstado])

  // ── Búsqueda con debounce ──────────────────────────────────
  const handleSearch = (value: string) => {
    setSearch(value)
    setPage(1)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => fetchCitas(value, 1, tabFecha, filtroEstado), 400)
  }

  const handleTabFecha = (tab: TabFecha) => {
    setTabFecha(tab); setPage(1); setCitas([])
  }

  const handleFiltroEstado = (estado: string) => {
    setFiltroEstado(estado); setPage(1); setCitas([])
  }

  // ── Abrir detalle ──────────────────────────────────────────
  const openDetalle = async (id: number) => {
    setDetailLoad(true); setSelected(null); setAccionError('')
    try {
      const { data } = await api.get<CitaDetalle>(`/appointments/${id}/`)
      setSelected(data)
    } finally { setDetailLoad(false) }
  }

  const reloadDetalle = async (id: number) => {
    try {
      const { data } = await api.get<CitaDetalle>(`/appointments/${id}/`)
      setSelected(data)
      fetchCitas(search, 1, tabFecha, filtroEstado)
    } catch { /* silencioso */ }
  }

  // ── Acciones de estado ─────────────────────────────────────
  const accionConfirmar = async () => {
    if (!selected) return
    setAccionando(true); setAccionError('')
    try {
      await api.post(`/appointments/${selected.cit_id}/confirmar/`)
      await reloadDetalle(selected.cit_id)
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } }
      setAccionError(e?.response?.data?.detail ?? 'Error al confirmar la cita.')
    } finally { setAccionando(false) }
  }

  const accionCancelar = async () => {
    if (!selected || !motivoCancel.trim()) return
    setAccionando(true); setAccionError('')
    try {
      await api.post(`/appointments/${selected.cit_id}/cancelar/`, {
        motivo_cancelacion: motivoCancel.trim(),
      })
      setShowCancelarModal(false); setMotivoCancel('')
      await reloadDetalle(selected.cit_id)
    } catch (err: unknown) {
      const e = err as { response?: { data?: unknown } }
      const d = e?.response?.data
      if (d && typeof d === 'object') {
        setAccionError(Object.values(d as Record<string, unknown>).flat().join(' '))
      } else { setAccionError('Error al cancelar la cita.') }
    } finally { setAccionando(false) }
  }

  const accionCompletar = async () => {
    if (!selected) return
    setAccionando(true); setAccionError('')
    try {
      await api.post(`/appointments/${selected.cit_id}/completar/`, {
        notas_medico: notasCompletar.trim(),
      })
      setShowCompletarModal(false); setNotasCompletar('')
      await reloadDetalle(selected.cit_id)
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } }
      setAccionError(e?.response?.data?.detail ?? 'Error al completar la cita.')
    } finally { setAccionando(false) }
  }

  // ── Búsqueda de pacientes en modal ─────────────────────────
  const buscarPacientes = (q: string) => {
    setPacSearch(q)
    if (q.length < 2) { setPacResults([]); setShowPacDrop(false); return }
    if (pacSearchTimer.current) clearTimeout(pacSearchTimer.current)
    setPacLoading(true)
    pacSearchTimer.current = setTimeout(async () => {
      try {
        const { data } = await api.get<{ results: PacienteBusqueda[] }>(
          `/patients/?search=${encodeURIComponent(q)}&page_size=8`
        )
        setPacResults(data.results ?? [])
        setShowPacDrop(true)
      } finally { setPacLoading(false) }
    }, 400)
  }

  const seleccionarPaciente = (p: PacienteBusqueda) => {
    setPacSelected(p)
    setForm(f => ({ ...f, paciente: p.pac_id }))
    setPacSearch(p.nombre_completo)
    setShowPacDrop(false)
  }

  // ── Cargar médicos al abrir modal ──────────────────────────
  const cargarMedicos = async () => {
    try {
      const { data } = await api.get<{ results?: MedicoBusqueda[] } | MedicoBusqueda[]>(
        `/auth/usuarios/?page_size=100`
      )
      const results = Array.isArray(data) ? data : (data as { results?: MedicoBusqueda[] }).results ?? []
      setMedicos(results)
    } catch { /* silencioso */ }
  }

  const abrirModal = () => {
    setForm(FORM_INICIAL); setPacSearch(''); setPacSelected(null)
    setPacResults([]); setFormError(''); setShowModal(true)
    cargarMedicos()
  }

  // ── Crear nueva cita ───────────────────────────────────────
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.paciente) { setFormError('Seleccione un paciente.'); return }
    if (!form.medico)   { setFormError('Seleccione un médico.'); return }
    setSaving(true); setFormError('')
    try {
      await api.post('/appointments/', form)
      setShowModal(false)
      fetchCitas(search, 1, tabFecha, filtroEstado)
    } catch (err: unknown) {
      const e = err as { response?: { data?: unknown } }
      const d = e?.response?.data
      if (d && typeof d === 'object') {
        const msgs = Object.entries(d as Record<string, unknown>)
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : String(v)}`)
          .join(' · ')
        setFormError(msgs)
      } else { setFormError('Error al guardar la cita.') }
    } finally { setSaving(false) }
  }

  const setField = (key: string) => (v: string | number) =>
    setForm(f => ({ ...f, [key]: v }))

  // ────────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full overflow-hidden">

      {/* ══ PANEL IZQUIERDO — Lista ══ */}
      <div className={clsx(
        'flex flex-col border-r border-gray-200 bg-white',
        selected || detailLoad
          ? 'hidden lg:flex w-[380px] xl:w-[420px] flex-shrink-0'
          : 'flex flex-1',
      )}>
        <div className="flex-shrink-0 px-4 pt-4 pb-3 border-b border-gray-100 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-gray-900 leading-tight">Citas</h1>
              <p className="text-xs text-gray-400">
                {loading && citas.length === 0 ? 'Cargando...' : `${total} cita${total !== 1 ? 's' : ''}`}
              </p>
            </div>
            <button onClick={abrirModal}
              className="flex items-center gap-1.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors">
              <Plus className="w-3.5 h-3.5" /> Nueva cita
            </button>
          </div>

          {/* Tabs de fecha */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
            {(['hoy', 'semana', 'mes', 'todas'] as TabFecha[]).map(t => (
              <button key={t} onClick={() => handleTabFecha(t)}
                className={clsx(
                  'flex-1 text-xs py-1 rounded-md transition-colors font-medium',
                  tabFecha === t ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500 hover:text-gray-700',
                )}>
                {t === 'semana' ? 'Semana' : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          {/* Búsqueda + filtro estado */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input type="text" value={search} onChange={e => handleSearch(e.target.value)}
                placeholder="Paciente, médico, motivo..."
                className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:bg-white transition" />
            </div>
            <div className="relative">
              <select value={filtroEstado} onChange={e => handleFiltroEstado(e.target.value)}
                className="appearance-none pl-3 pr-7 py-2 text-xs border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-300 text-gray-700">
                <option value="">Todos</option>
                <option value="PROGRAMADA">Programada</option>
                <option value="CONFIRMADA">Confirmada</option>
                <option value="EN_PROGRESO">En progreso</option>
                <option value="COMPLETADA">Completada</option>
                <option value="CANCELADA">Cancelada</option>
                <option value="NO_ASISTIO">No asistió</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto">
          {listError && (
            <div className="m-3 p-3 bg-red-50 border border-red-100 rounded-lg flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700 flex-1">{listError}</p>
              <button onClick={() => fetchCitas(search, 1, tabFecha, filtroEstado)} className="text-red-400 hover:text-red-600">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {loading && citas.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <div className="h-6 w-6 animate-spin rounded-full border-[3px] border-primary-500 border-t-transparent" />
            </div>
          ) : citas.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-300">
              <Calendar className="w-12 h-12 mb-2" />
              <p className="text-sm text-gray-400">Sin citas en este período</p>
            </div>
          ) : (
            <ul>
              {citas.map(c => (
                <li key={c.cit_id}>
                  <button
                    onClick={() => openDetalle(c.cit_id)}
                    className={clsx(
                      'w-full text-left px-4 py-3 flex items-start gap-3 transition-colors hover:bg-gray-50 border-b border-gray-50',
                      selected?.cit_id === c.cit_id && 'bg-primary-50 border-l-4 border-primary-500 pl-3',
                    )}
                  >
                    <div className="flex-shrink-0 text-center w-12">
                      <p className="text-sm font-bold text-gray-800 leading-none">{c.hora_inicio_fmt}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{c.hora_fin_fmt}</p>
                    </div>
                    <div className="flex flex-col items-center flex-shrink-0 pt-1">
                      <div className={clsx('w-2.5 h-2.5 rounded-full', ESTADO_DOT[c.estado])} />
                      <div className="w-px flex-1 bg-gray-200 mt-1" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900 truncate leading-tight">{c.paciente_nombre}</p>
                      <p className="text-xs text-gray-500 truncate">
                        Exp.&nbsp;<span className="font-mono">{c.paciente_expediente}</span>
                        &nbsp;·&nbsp;Dr.&nbsp;{c.medico_nombre}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span className={clsx('text-xs px-1.5 py-0.5 rounded-full font-medium', ESTADO_COLORS[c.estado])}>
                          {c.estado_display}
                        </span>
                        <span className="text-xs text-gray-400">{c.tipo_cita_display}</span>
                        {c.prioridad !== 'NORMAL' && (
                          <span className={clsx(
                            'text-xs px-1.5 py-0.5 rounded-full font-medium',
                            c.prioridad === 'URGENTE' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700',
                          )}>
                            {c.prioridad_display}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-300 flex-shrink-0 mt-1" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {hasMore && (
            <button
              onClick={() => { const next = page + 1; setPage(next); fetchCitas(search, next, tabFecha, filtroEstado) }}
              className="w-full py-3 text-xs text-primary-600 hover:bg-primary-50 transition-colors">
              Cargar más citas...
            </button>
          )}
        </div>
      </div>

      {/* ══ PANEL DERECHO — Detalle ══ */}
      {(selected || detailLoad) ? (
        <div className="flex-1 flex flex-col min-w-0 bg-gray-50 overflow-hidden">
          {detailLoad ? (
            <div className="flex items-center justify-center h-full">
              <div className="h-7 w-7 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
            </div>
          ) : selected && (
            <>
              <div className="flex-shrink-0 bg-white border-b border-gray-200 px-5 py-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary-100 flex-shrink-0 flex items-center justify-center">
                    <Calendar className="w-6 h-6 text-primary-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-base font-bold text-gray-900 leading-tight">{selected.paciente_nombre}</h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Exp.&nbsp;<span className="font-mono">{selected.paciente_expediente}</span>
                      &nbsp;·&nbsp;Dr.&nbsp;{selected.medico_nombre}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-1.5">
                      <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', ESTADO_COLORS[selected.estado])}>
                        {selected.estado_display}
                      </span>
                      {selected.prioridad !== 'NORMAL' && (
                        <span className={clsx(
                          'text-xs px-2 py-0.5 rounded-full font-medium',
                          selected.prioridad === 'URGENTE' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700',
                        )}>
                          {selected.prioridad_display}
                        </span>
                      )}
                      <span className="text-xs text-gray-500">{selected.tipo_cita_display}</span>
                    </div>
                  </div>
                  <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {accionError && (
                  <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">{accionError}</div>
                )}

                {/* Botones de acción por estado */}
                {['PROGRAMADA', 'CONFIRMADA', 'EN_PROGRESO'].includes(selected.estado) && (
                  <div className="flex gap-2 mt-3">
                    {selected.estado === 'PROGRAMADA' && (
                      <ActionBtn icon={<CheckCircle className="w-3.5 h-3.5" />} label="Confirmar"
                        color="teal" loading={accionando} onClick={accionConfirmar} />
                    )}
                    {['CONFIRMADA', 'EN_PROGRESO'].includes(selected.estado) && (
                      <ActionBtn icon={<PlayCircle className="w-3.5 h-3.5" />} label="Completar"
                        color="green" loading={accionando}
                        onClick={() => { setNotasCompletar(''); setShowCompletarModal(true) }} />
                    )}
                    <ActionBtn icon={<XCircle className="w-3.5 h-3.5" />} label="Cancelar"
                      color="red" loading={accionando}
                      onClick={() => { setMotivoCancel(''); setAccionError(''); setShowCancelarModal(true) }} />
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                <CitaSeccion icon={<Clock />} titulo="Horario">
                  <CitaGrid>
                    <CitaCampo label="Fecha"      valor={selected.fecha_cita} />
                    <CitaCampo label="Hora"       valor={`${selected.hora_inicio_fmt} — ${selected.hora_fin_fmt}`} />
                    <CitaCampo label="Duración"   valor={`${selected.duracion_min} min`} />
                    {selected.sala && <CitaCampo label="Sala / Consultorio" valor={selected.sala} />}
                  </CitaGrid>
                </CitaSeccion>

                <CitaSeccion icon={<Stethoscope />} titulo="Información de la cita">
                  <CitaGrid>
                    <CitaCampo label="Tipo de cita" valor={selected.tipo_cita_display} />
                    <CitaCampo label="Médico"       valor={`Dr. ${selected.medico_nombre}`} />
                  </CitaGrid>
                  <div className="mt-3">
                    <p className="text-xs text-gray-400 font-medium mb-0.5">Motivo de consulta</p>
                    <p className="text-sm text-gray-800">{selected.motivo}</p>
                  </div>
                  {selected.notas_admin && (
                    <div className="mt-3">
                      <p className="text-xs text-gray-400 font-medium mb-0.5">Notas administrativas</p>
                      <p className="text-sm text-gray-700">{selected.notas_admin}</p>
                    </div>
                  )}
                </CitaSeccion>

                {selected.notas_medico && (
                  <CitaSeccion icon={<FileText />} titulo="Notas del médico">
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{selected.notas_medico}</p>
                  </CitaSeccion>
                )}

                {selected.estado === 'CANCELADA' && (
                  <CitaSeccion icon={<XCircle />} titulo="Cancelación" alerta>
                    <CitaGrid>
                      <CitaCampo label="Cancelada por" valor={selected.cancelada_por_nombre ?? '—'} />
                      <CitaCampo label="Fecha" valor={selected.cancelada_en
                        ? new Date(selected.cancelada_en).toLocaleString('es-GT') : '—'} />
                    </CitaGrid>
                    {selected.motivo_cancelacion && (
                      <div className="mt-3">
                        <p className="text-xs text-gray-500 font-medium mb-0.5">Motivo</p>
                        <p className="text-sm text-gray-800">{selected.motivo_cancelacion}</p>
                      </div>
                    )}
                  </CitaSeccion>
                )}

                <CitaSeccion icon={<User />} titulo="Registro">
                  <CitaGrid>
                    <CitaCampo label="Creada el"    valor={new Date(selected.created_at).toLocaleString('es-GT')} />
                    <CitaCampo label="Actualizada"  valor={new Date(selected.updated_at).toLocaleString('es-GT')} />
                  </CitaGrid>
                </CitaSeccion>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="hidden lg:flex flex-1 items-center justify-center flex-col gap-3 text-gray-200 bg-gray-50">
          <ClipboardList className="w-20 h-20" />
          <p className="text-sm text-gray-400">Selecciona una cita para ver el detalle</p>
        </div>
      )}

      {/* ══ MODAL CANCELAR ══ */}
      {showCancelarModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <XCircle className="w-5 h-5 text-red-500" /> Cancelar cita
              </h3>
              <button onClick={() => setShowCancelarModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-gray-600">Esta acción quedará registrada en el sistema de auditoría HIPAA.</p>
              <label className="block">
                <span className="text-xs text-gray-500 font-medium block mb-1">Motivo de cancelación *</span>
                <textarea value={motivoCancel} onChange={e => setMotivoCancel(e.target.value)}
                  rows={3} placeholder="Indique el motivo..."
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-300 resize-none" />
              </label>
              {accionError && <p className="text-xs text-red-600">{accionError}</p>}
            </div>
            <div className="flex justify-end gap-3 px-5 py-4 border-t border-gray-100 bg-gray-50 rounded-b-xl">
              <button onClick={() => setShowCancelarModal(false)}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition">Volver</button>
              <button onClick={accionCancelar} disabled={accionando || motivoCancel.trim().length < 5}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-60">
                {accionando ? <RefreshCw className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                Confirmar cancelación
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL COMPLETAR ══ */}
      {showCompletarModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <PlayCircle className="w-5 h-5 text-green-500" /> Completar cita
              </h3>
              <button onClick={() => setShowCompletarModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5">
              <label className="block">
                <span className="text-xs text-gray-500 font-medium block mb-1">Notas del médico (opcional)</span>
                <textarea value={notasCompletar} onChange={e => setNotasCompletar(e.target.value)}
                  rows={4} placeholder="Observaciones, diagnóstico, indicaciones..."
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-300 resize-none" />
              </label>
            </div>
            <div className="flex justify-end gap-3 px-5 py-4 border-t border-gray-100 bg-gray-50 rounded-b-xl">
              <button onClick={() => setShowCompletarModal(false)}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition">Cancelar</button>
              <button onClick={accionCompletar} disabled={accionando}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-60">
                {accionando ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Marcar como completada
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL NUEVA CITA ══ */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 flex-shrink-0">
              <h3 className="font-bold text-gray-900">Nueva Cita Médica</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form id="form-cita" onSubmit={handleCreate} className="flex-1 overflow-y-auto p-5 space-y-5">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" /><span>{formError}</span>
                </div>
              )}

              {/* Paciente */}
              <Fieldset legend="Paciente *">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input type="text" value={pacSearch} onChange={e => buscarPacientes(e.target.value)}
                    onFocus={() => pacResults.length > 0 && setShowPacDrop(true)}
                    placeholder="Buscar por nombre, expediente o DPI..."
                    className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300" />
                  {pacLoading && (
                    <RefreshCw className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 animate-spin" />
                  )}
                  {showPacDrop && pacResults.length > 0 && (
                    <ul className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {pacResults.map(p => (
                        <li key={p.pac_id}>
                          <button type="button" onClick={() => seleccionarPaciente(p)}
                            className="w-full text-left px-3 py-2 hover:bg-primary-50 transition-colors">
                            <p className="text-sm font-medium text-gray-900">{p.nombre_completo}</p>
                            <p className="text-xs text-gray-500">Exp. {p.no_expediente} · {p.no_documento}</p>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {pacSelected && (
                  <p className="mt-1.5 text-xs text-primary-700 flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" />
                    <strong>{pacSelected.nombre_completo}</strong>&nbsp;— Exp.&nbsp;{pacSelected.no_expediente}
                  </p>
                )}
              </Fieldset>

              {/* Médico y horario */}
              <Fieldset legend="Médico y Horario">
                <div className="grid grid-cols-2 gap-3">
                  <label className="block col-span-2">
                    <span className="text-xs text-gray-500 font-medium block mb-1">Médico *</span>
                    <select
                      value={form.medico ?? ''}
                      onChange={e => setForm(f => ({ ...f, medico: e.target.value ? Number(e.target.value) : null }))}
                      required
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white"
                    >
                      <option value="">-- Seleccionar médico --</option>
                      {medicos.map(m => (
                        <option key={m.usr_id} value={m.usr_id}>
                          Dr. {m.primer_nombre} {m.primer_apellido}
                        </option>
                      ))}
                    </select>
                  </label>
                  <FormInput label="Fecha *"          value={form.fecha_cita}   onChange={setField('fecha_cita')}   type="date" required />
                  <FormInput label="Sala / Consult."  value={form.sala}         onChange={setField('sala')} />
                  <FormInput label="Hora inicio *"    value={form.hora_inicio}  onChange={setField('hora_inicio')}  type="time" required />
                  <FormInput label="Hora fin *"        value={form.hora_fin}     onChange={setField('hora_fin')}     type="time" required />
                </div>
              </Fieldset>

              {/* Detalles */}
              <Fieldset legend="Detalles de la Cita">
                <div className="grid grid-cols-2 gap-3">
                  <FormSelect label="Tipo de cita *" value={form.tipo_cita} onChange={setField('tipo_cita')}
                    options={[['CONSULTA','Consulta General'],['SEGUIMIENTO','Seguimiento'],['URGENCIA','Urgencia'],['PROCEDIMIENTO','Procedimiento'],['CHEQUEO','Chequeo General']]} />
                  <FormSelect label="Prioridad" value={form.prioridad} onChange={setField('prioridad')}
                    options={[['NORMAL','Normal'],['PREFERENTE','Preferente'],['URGENTE','Urgente']]} />
                </div>
                <div className="mt-3">
                  <label className="block">
                    <span className="text-xs text-gray-500 font-medium block mb-1">Motivo de consulta *</span>
                    <textarea value={form.motivo} onChange={e => setField('motivo')(e.target.value)} required
                      rows={2} placeholder="Describa brevemente el motivo..."
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none" />
                  </label>
                </div>
                <div className="mt-3">
                  <label className="block">
                    <span className="text-xs text-gray-500 font-medium block mb-1">Notas administrativas</span>
                    <input type="text" value={form.notas_admin} onChange={e => setField('notas_admin')(e.target.value)}
                      placeholder="Instrucciones especiales, preparación..."
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300" />
                  </label>
                </div>
              </Fieldset>
            </form>

            <div className="flex-shrink-0 flex justify-end gap-3 px-5 py-4 border-t border-gray-100 bg-gray-50 rounded-b-xl">
              <button type="button" onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition">Cancelar</button>
              <button type="submit" form="form-cita" disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-60">
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Guardar cita
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// Componentes auxiliares UI
// ────────────────────────────────────────────────────────────
function CitaSeccion({ icon, titulo, alerta = false, children }: {
  icon: React.ReactNode; titulo: string; alerta?: boolean; children: React.ReactNode
}) {
  return (
    <div className={clsx('bg-white rounded-xl border overflow-hidden', alerta ? 'border-red-300' : 'border-gray-200')}>
      <div className={clsx('flex items-center gap-2 px-4 py-2.5 border-b', alerta ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-100')}>
        <span className={clsx('flex-shrink-0 [&>svg]:w-3.5 [&>svg]:h-3.5', alerta ? 'text-red-500' : 'text-primary-600')}>{icon}</span>
        <h3 className={clsx('text-xs font-semibold uppercase tracking-wide', alerta ? 'text-red-700' : 'text-gray-600')}>{titulo}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

function CitaGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>
}

function CitaCampo({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <p className="text-xs text-gray-400 font-medium leading-none mb-0.5">{label}</p>
      <p className="text-sm text-gray-800 break-words">{valor || '—'}</p>
    </div>
  )
}

function ActionBtn({ icon, label, color, loading, onClick }: {
  icon: React.ReactNode; label: string; color: 'teal' | 'green' | 'red'; loading: boolean; onClick: () => void
}) {
  const colors = {
    teal:  'bg-teal-600 hover:bg-teal-700 text-white',
    green: 'bg-green-600 hover:bg-green-700 text-white',
    red:   'bg-red-100 hover:bg-red-200 text-red-700',
  }
  return (
    <button onClick={onClick} disabled={loading}
      className={clsx('flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition disabled:opacity-60', colors[color])}>
      <span className="[&>svg]:w-3.5 [&>svg]:h-3.5">{icon}</span>{label}
    </button>
  )
}

function Fieldset({ legend, children }: { legend: string; children: React.ReactNode }) {
  return (
    <fieldset className="border border-gray-100 rounded-lg p-4">
      <legend className="px-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">{legend}</legend>
      <div className="mt-2">{children}</div>
    </fieldset>
  )
}

function FormInput({ label, value, onChange, type = 'text', required = false }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean
}) {
  return (
    <label className="block">
      <span className="text-xs text-gray-500 font-medium block mb-1">{label}</span>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} required={required}
        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300 transition bg-white" />
    </label>
  )
}

function FormSelect({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: [string, string][]
}) {
  return (
    <label className="block">
      <span className="text-xs text-gray-500 font-medium block mb-1">{label}</span>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white transition">
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  )
}
