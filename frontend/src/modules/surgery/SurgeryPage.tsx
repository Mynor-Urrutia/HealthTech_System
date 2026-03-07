/**
 * HealthTech Solutions — M06 Cirugía / Quirófano
 * Panel dividido: agenda quirúrgica (izquierda) + detalle/acciones (derecha)
 *
 * Máquina de estados:
 *   PROGRAMADA → [iniciar] → EN_CURSO → [completar] → COMPLETADA
 *                                      → [suspender] → SUSPENDIDA
 *   PROGRAMADA → [cancelar] → CANCELADA
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import api from '@/services/api'

// ────────────────────────────────────────────────────────────
// Tipos
// ────────────────────────────────────────────────────────────
interface Cirugia {
  cir_id: number
  fecha_programada: string
  hora_ini_fmt: string
  hora_fin_fmt: string
  duracion_est_min: number | null
  quirofano: string
  tipo_cirugia: string
  especialidad: string
  prioridad: string
  prioridad_display: string
  tipo_anestesia: string
  tipo_anestesia_display: string
  estado: string
  estado_display: string
  paciente_nombre: string
  paciente_expediente: string
  cirujano_nombre: string
  anestesiologo_nombre?: string
  enfermero_inst_nombre?: string
  enfermero_circ_nombre?: string
  cie10_pre?: string
  diagnostico_preop?: string
  notas_preop?: string
  fecha_inicio_real?: string
  hora_inicio_real_fmt?: string
  fecha_fin_real?: string
  hora_fin_real_fmt?: string
  duracion_real_min?: number | null
  hallazgos?: string
  complicaciones?: string
  notas_postop?: string
  diagnostico_postop?: string
  cie10_post?: string
  motivo_cancelacion?: string
  created_at?: string
  updated_at?: string
}

interface Usuario {
  usr_id: number
  full_name: string
  tipo_personal: string
}

interface Paciente {
  pac_id: number
  primer_nombre: string
  primer_apellido: string
  no_expediente: string
}

// ────────────────────────────────────────────────────────────
// Mapas de colores
// ────────────────────────────────────────────────────────────
const PRIORIDAD_COLORS: Record<string, string> = {
  EMERGENCIA: 'bg-red-100 text-red-800 border border-red-200',
  URGENTE: 'bg-orange-100 text-orange-800 border border-orange-200',
  ELECTIVA: 'bg-blue-100 text-blue-800 border border-blue-200',
}

const PRIORIDAD_DOT: Record<string, string> = {
  EMERGENCIA: 'bg-red-500',
  URGENTE: 'bg-orange-500',
  ELECTIVA: 'bg-blue-500',
}

const ESTADO_COLORS: Record<string, string> = {
  PROGRAMADA: 'bg-sky-100 text-sky-800',
  EN_CURSO: 'bg-amber-100 text-amber-800',
  COMPLETADA: 'bg-green-100 text-green-800',
  SUSPENDIDA: 'bg-orange-100 text-orange-800',
  CANCELADA: 'bg-gray-100 text-gray-600',
}

// ────────────────────────────────────────────────────────────
// Componente principal
// ────────────────────────────────────────────────────────────
export default function SurgeryPage() {
  // Lista
  const [cirugias, setCirugias] = useState<Cirugia[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<Cirugia | null>(null)

  // Filtros
  const [search, setSearch] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroPrioridad, setFiltroPrioridad] = useState('')
  const [soloActivos, setSoloActivos] = useState(false)

  // Recursos
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [_pacientes, _setPacientes] = useState<Paciente[]>([])
  const [busquedaPac, setBusquedaPac] = useState('')
  const [pacSugs, setPacSugs] = useState<Paciente[]>([])
  const pacDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Modales
  const [showNueva, setShowNueva] = useState(false)
  const [showIniciar, setShowIniciar] = useState(false)
  const [showCompletar, setShowCompletar] = useState(false)
  const [showFinalizar, setShowFinalizar] = useState<'cancelar' | 'suspender' | null>(null)

  // Forms
  const [formNueva, setFormNueva] = useState({
    paciente: '', cirujano: '', anestesiologo: '',
    fecha_programada: '', hora_ini_prog: '07:00', hora_fin_prog: '09:00',
    duracion_est_min: '120', quirofano: 'QX-1',
    tipo_cirugia: '', especialidad: '', prioridad: 'ELECTIVA',
    tipo_anestesia: 'GENERAL', diagnostico_preop: '', cie10_pre: '',
  })
  const [formIniciar, setFormIniciar] = useState({ notas_preop_adicionales: '' })
  const [formCompletar, setFormCompletar] = useState({
    hallazgos: '', diagnostico_postop: '', cie10_post: '',
    complicaciones: '', notas_postop: '',
  })
  const [formMotivo, setFormMotivo] = useState({ motivo: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // ────────────────────────────────────────────────────────
  // Data loading
  // ────────────────────────────────────────────────────────
  const cargarCirugias = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (filtroEstado) params.estado = filtroEstado
      if (filtroPrioridad) params.prioridad = filtroPrioridad
      if (soloActivos) params.activos = '1'
      if (search) params.search = search

      const res = await api.get('/surgery/', { params })
      setCirugias(res.data.results ?? [])
      setTotal(res.data.count ?? 0)
    } catch {
      setCirugias([])
    } finally {
      setLoading(false)
    }
  }, [filtroEstado, filtroPrioridad, soloActivos, search])

  const cargarDetalle = async (id: number) => {
    try {
      const res = await api.get(`/surgery/${id}/`)
      setSelected(res.data)
    } catch {/* ignore */ }
  }

  const cargarRecursos = async () => {
    try {
      const res = await api.get('/auth/usuarios/?page_size=100')
      setUsuarios(res.data.results ?? [])
    } catch {/* ignore */ }
  }

  useEffect(() => { cargarCirugias() }, [cargarCirugias])
  useEffect(() => { cargarRecursos() }, [])

  // ────────────────────────────────────────────────────────
  // Búsqueda de paciente con debounce
  // ────────────────────────────────────────────────────────
  useEffect(() => {
    if (pacDebounce.current) clearTimeout(pacDebounce.current)
    if (busquedaPac.length < 2) { setPacSugs([]); return }
    pacDebounce.current = setTimeout(async () => {
      try {
        const r = await api.get(`/patients/?search=${busquedaPac}&page_size=8`)
        setPacSugs(r.data.results ?? [])
      } catch { setPacSugs([]) }
    }, 400)
  }, [busquedaPac])

  // ────────────────────────────────────────────────────────
  // Helpers
  // ────────────────────────────────────────────────────────
  const resetModalNueva = () => {
    setFormNueva({
      paciente: '', cirujano: '', anestesiologo: '',
      fecha_programada: '', hora_ini_prog: '07:00', hora_fin_prog: '09:00',
      duracion_est_min: '120', quirofano: 'QX-1',
      tipo_cirugia: '', especialidad: '', prioridad: 'ELECTIVA',
      tipo_anestesia: 'GENERAL', diagnostico_preop: '', cie10_pre: '',
    })
    setBusquedaPac(''); setPacSugs([]); setError('')
  }

  // ────────────────────────────────────────────────────────
  // Handlers de estado
  // ────────────────────────────────────────────────────────
  const handleCrear = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true); setError('')
    try {
      await api.post('/surgery/', {
        ...formNueva,
        paciente: parseInt(formNueva.paciente),
        cirujano: parseInt(formNueva.cirujano),
        anestesiologo: formNueva.anestesiologo ? parseInt(formNueva.anestesiologo) : null,
        duracion_est_min: formNueva.duracion_est_min ? parseInt(formNueva.duracion_est_min) : null,
      })
      setShowNueva(false); resetModalNueva(); cargarCirugias()
    } catch (err: unknown) {
      const e = err as { response?: { data?: Record<string, unknown> } }
      const msg = e.response?.data
      setError(typeof msg === 'object' ? JSON.stringify(msg) : 'Error al programar la cirugía')
    } finally { setSubmitting(false) }
  }

  const handleIniciar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected) return
    setSubmitting(true); setError('')
    try {
      const res = await api.post(`/surgery/${selected.cir_id}/iniciar/`, formIniciar)
      setSelected(res.data); setShowIniciar(false)
      setFormIniciar({ notas_preop_adicionales: '' })
      cargarCirugias()
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } }
      setError(e.response?.data?.detail ?? 'Error al iniciar')
    } finally { setSubmitting(false) }
  }

  const handleCompletar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected) return
    setSubmitting(true); setError('')
    try {
      const res = await api.post(`/surgery/${selected.cir_id}/completar/`, formCompletar)
      setSelected(res.data); setShowCompletar(false)
      setFormCompletar({ hallazgos: '', diagnostico_postop: '', cie10_post: '', complicaciones: '', notas_postop: '' })
      cargarCirugias()
    } catch (err: unknown) {
      const e = err as { response?: { data?: Record<string, unknown> } }
      const msg = e.response?.data
      setError(typeof msg === 'object' ? JSON.stringify(msg) : 'Error al completar')
    } finally { setSubmitting(false) }
  }

  const handleFinalizar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected || !showFinalizar) return
    setSubmitting(true); setError('')
    try {
      const endpoint = showFinalizar === 'cancelar' ? 'cancelar' : 'suspender'
      const res = await api.post(`/surgery/${selected.cir_id}/${endpoint}/`, formMotivo)
      setSelected(res.data); setShowFinalizar(null)
      setFormMotivo({ motivo: '' })
      cargarCirugias()
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string; motivo?: string[] } } }
      setError(e.response?.data?.detail ?? e.response?.data?.motivo?.[0] ?? 'Error')
    } finally { setSubmitting(false) }
  }

  // ────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cirugías</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Módulo M06 — {total} registro{total !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => { resetModalNueva(); setShowNueva(true) }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <span className="text-lg leading-none">+</span> Programar Cirugía
        </button>
      </div>

      {/* ── Filtros ── */}
      <div className="flex gap-3 mb-4 flex-wrap items-center">
        <div className="relative flex-1 min-w-48">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Paciente, tipo, quirófano..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todos los estados</option>
          <option value="PROGRAMADA">Programada</option>
          <option value="EN_CURSO">En Curso</option>
          <option value="COMPLETADA">Completada</option>
          <option value="SUSPENDIDA">Suspendida</option>
          <option value="CANCELADA">Cancelada</option>
        </select>
        <select
          value={filtroPrioridad} onChange={e => setFiltroPrioridad(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Toda prioridad</option>
          <option value="EMERGENCIA">Emergencia</option>
          <option value="URGENTE">Urgente</option>
          <option value="ELECTIVA">Electiva</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
          <input type="checkbox" checked={soloActivos} onChange={e => setSoloActivos(e.target.checked)}
            className="rounded" />
          Solo activas
        </label>
      </div>

      {/* ── Split panel ── */}
      <div className="flex gap-4 flex-1 min-h-0 overflow-hidden">

        {/* ── Lista ── */}
        <div className="w-96 flex-shrink-0 flex flex-col overflow-hidden bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-3 py-2 border-b border-gray-100 text-xs font-medium text-gray-500 bg-gray-50">
            {loading ? 'Cargando…' : `${cirugias.length} cirugía${cirugias.length !== 1 ? 's' : ''}`}
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
            {cirugias.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center h-full text-center py-16 px-6">
                <span className="text-4xl mb-3">🏥</span>
                <p className="text-gray-500 text-sm">No hay cirugías que coincidan</p>
              </div>
            )}
            {cirugias.map(c => (
              <button
                key={c.cir_id}
                onClick={() => cargarDetalle(c.cir_id)}
                className={`w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors ${selected?.cir_id === c.cir_id ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''}`}
              >
                {/* Top row */}
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-medium text-gray-900 text-sm truncate">{c.paciente_nombre}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${ESTADO_COLORS[c.estado] ?? 'bg-gray-100 text-gray-600'}`}>
                    {c.estado_display}
                  </span>
                </div>
                {/* Procedure */}
                <p className="text-xs text-gray-600 truncate mb-1">{c.tipo_cirugia}</p>
                {/* Meta row */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${PRIORIDAD_COLORS[c.prioridad] ?? ''}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${PRIORIDAD_DOT[c.prioridad]}`} />
                    {c.prioridad_display}
                  </span>
                  <span className="text-xs text-gray-400">🗓 {c.fecha_programada}</span>
                  <span className="text-xs text-gray-400">⏰ {c.hora_ini_fmt}</span>
                  <span className="text-xs text-gray-400">🔬 {c.quirofano}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── Detalle ── */}
        <div className="flex-1 overflow-y-auto">
          {!selected ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <span className="text-5xl mb-4">🏥</span>
              <p className="text-gray-500 font-medium">Seleccione una cirugía</p>
              <p className="text-gray-400 text-sm">Ver detalle e historial quirúrgico</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              {/* Header detalle */}
              <div className="px-6 py-4 border-b border-gray-100 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{selected.paciente_nombre}</h2>
                  <p className="text-sm text-gray-500">
                    Exp. {selected.paciente_expediente} · CIR-{selected.cir_id} · {selected.quirofano}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`text-sm px-3 py-1 rounded-full font-medium ${ESTADO_COLORS[selected.estado] ?? ''}`}>
                    {selected.estado_display}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORIDAD_COLORS[selected.prioridad] ?? ''}`}>
                    {selected.prioridad_display}
                  </span>
                </div>
              </div>

              <div className="p-6 space-y-5">
                {/* Programación */}
                <section>
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                    <span>🗓</span> Programación Quirúrgica
                  </h3>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                    <div className="text-gray-500">Fecha:</div>
                    <div className="text-gray-900 font-medium">{selected.fecha_programada}</div>
                    <div className="text-gray-500">Horario:</div>
                    <div className="text-gray-900">{selected.hora_ini_fmt} – {selected.hora_fin_fmt || '—'}</div>
                    <div className="text-gray-500">Duración est.:</div>
                    <div className="text-gray-900">{selected.duracion_est_min ? `${selected.duracion_est_min} min` : '—'}</div>
                    <div className="text-gray-500">Tipo cirugía:</div>
                    <div className="text-gray-900 font-medium">{selected.tipo_cirugia}</div>
                    <div className="text-gray-500">Especialidad:</div>
                    <div className="text-gray-900">{selected.especialidad || '—'}</div>
                    <div className="text-gray-500">Anestesia:</div>
                    <div className="text-gray-900">{selected.tipo_anestesia_display}</div>
                  </div>
                </section>

                {/* Equipo quirúrgico */}
                <section>
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                    <span>👨‍⚕️</span> Equipo Quirúrgico
                  </h3>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                    <div className="text-gray-500">Cirujano:</div>
                    <div className="text-gray-900 font-medium">{selected.cirujano_nombre}</div>
                    <div className="text-gray-500">Anestesiólogo:</div>
                    <div className="text-gray-900">{selected.anestesiologo_nombre ?? '—'}</div>
                    <div className="text-gray-500">Enf. Instrumentista:</div>
                    <div className="text-gray-900">{selected.enfermero_inst_nombre ?? '—'}</div>
                    <div className="text-gray-500">Enf. Circulante:</div>
                    <div className="text-gray-900">{selected.enfermero_circ_nombre ?? '—'}</div>
                  </div>
                </section>

                {/* Pre-operatorio */}
                {(selected.diagnostico_preop || selected.notas_preop) && (
                  <section>
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                      <span>📋</span> Pre-operatorio
                    </h3>
                    <div className="text-sm space-y-1">
                      {selected.cie10_pre && <p className="text-gray-500">CIE-10: <span className="font-mono text-gray-900">{selected.cie10_pre}</span></p>}
                      {selected.diagnostico_preop && <p className="text-gray-900">{selected.diagnostico_preop}</p>}
                      {selected.notas_preop && (
                        <p className="text-gray-600 text-xs bg-gray-50 rounded p-2 mt-1 whitespace-pre-wrap">{selected.notas_preop}</p>
                      )}
                    </div>
                  </section>
                )}

                {/* Post-operatorio */}
                {selected.estado === 'COMPLETADA' && (
                  <section>
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                      <span>✅</span> Post-operatorio
                    </h3>
                    <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm mb-3">
                      <div className="text-gray-500">Inicio real:</div>
                      <div className="text-gray-900">{selected.fecha_inicio_real} {selected.hora_inicio_real_fmt}</div>
                      <div className="text-gray-500">Fin real:</div>
                      <div className="text-gray-900">{selected.fecha_fin_real} {selected.hora_fin_real_fmt}</div>
                      <div className="text-gray-500">Duración real:</div>
                      <div className="text-gray-900 font-semibold">{selected.duracion_real_min ?? '—'} min</div>
                      {selected.cie10_post && <><div className="text-gray-500">CIE-10 post:</div><div className="font-mono text-gray-900">{selected.cie10_post}</div></>}
                    </div>
                    {selected.hallazgos && (
                      <div className="mb-2">
                        <p className="text-xs font-medium text-gray-500 mb-1">Hallazgos intraoperatorios</p>
                        <p className="text-sm text-gray-900 bg-gray-50 rounded p-2 whitespace-pre-wrap">{selected.hallazgos}</p>
                      </div>
                    )}
                    {selected.diagnostico_postop && (
                      <div className="mb-2">
                        <p className="text-xs font-medium text-gray-500 mb-1">Diagnóstico post-operatorio</p>
                        <p className="text-sm text-gray-900">{selected.diagnostico_postop}</p>
                      </div>
                    )}
                    {selected.complicaciones && (
                      <div>
                        <p className="text-xs font-medium text-red-600 mb-1">Complicaciones</p>
                        <p className="text-sm text-gray-900">{selected.complicaciones}</p>
                      </div>
                    )}
                  </section>
                )}

                {/* Motivo cancelación / suspensión */}
                {(selected.estado === 'CANCELADA' || selected.estado === 'SUSPENDIDA') && selected.motivo_cancelacion && (
                  <section className="bg-red-50 border border-red-100 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-red-700 mb-1">
                      {selected.estado === 'CANCELADA' ? '❌ Motivo de cancelación' : '⚠️ Motivo de suspensión'}
                    </h3>
                    <p className="text-sm text-red-800">{selected.motivo_cancelacion}</p>
                  </section>
                )}

                {/* En curso info */}
                {selected.estado === 'EN_CURSO' && (
                  <section className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-amber-800 mb-1">⏱ Cirugía en progreso</h3>
                    <p className="text-sm text-amber-700">
                      Iniciada: {selected.fecha_inicio_real} a las {selected.hora_inicio_real_fmt}
                    </p>
                  </section>
                )}

                {/* Acciones de estado */}
                <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                  {selected.estado === 'PROGRAMADA' && (
                    <>
                      <button
                        onClick={() => { setShowIniciar(true); setError('') }}
                        className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                      >
                        ▶ Iniciar Cirugía
                      </button>
                      <button
                        onClick={() => { setShowFinalizar('cancelar'); setFormMotivo({ motivo: '' }); setError('') }}
                        className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors"
                      >
                        ✕ Cancelar
                      </button>
                    </>
                  )}
                  {selected.estado === 'EN_CURSO' && (
                    <>
                      <button
                        onClick={() => { setShowCompletar(true); setFormCompletar({ hallazgos: '', diagnostico_postop: '', cie10_post: '', complicaciones: '', notas_postop: '' }); setError('') }}
                        className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                      >
                        ✓ Completar Cirugía
                      </button>
                      <button
                        onClick={() => { setShowFinalizar('suspender'); setFormMotivo({ motivo: '' }); setError('') }}
                        className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 bg-orange-100 hover:bg-orange-200 text-orange-700 rounded-lg transition-colors"
                      >
                        ⚠ Suspender
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════
          MODAL — Nueva Cirugía
      ════════════════════════════════════════════════════ */}
      {showNueva && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">Programar Cirugía</h3>
              <button onClick={() => setShowNueva(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <form onSubmit={handleCrear} className="p-6 space-y-4">
              {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{error}</div>}

              {/* Paciente */}
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">Paciente *</label>
                <input
                  value={busquedaPac}
                  onChange={e => { setBusquedaPac(e.target.value); setFormNueva(f => ({ ...f, paciente: '' })) }}
                  placeholder="Buscar por nombre o expediente..."
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {pacSugs.length > 0 && (
                  <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                    {pacSugs.map(p => (
                      <button
                        key={p.pac_id} type="button"
                        onClick={() => {
                          setFormNueva(f => ({ ...f, paciente: String(p.pac_id) }))
                          setBusquedaPac(`${p.primer_nombre} ${p.primer_apellido} (${p.no_expediente})`)
                          setPacSugs([])
                        }}
                        className="w-full text-left px-4 py-2 text-sm hover:bg-blue-50"
                      >
                        {p.primer_nombre} {p.primer_apellido} · <span className="text-gray-500 font-mono">{p.no_expediente}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Fecha y horario */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha *</label>
                  <input type="date" required value={formNueva.fecha_programada}
                    onChange={e => setFormNueva(f => ({ ...f, fecha_programada: e.target.value }))}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hora inicio *</label>
                  <input type="time" required value={formNueva.hora_ini_prog}
                    onChange={e => setFormNueva(f => ({ ...f, hora_ini_prog: e.target.value }))}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hora fin est.</label>
                  <input type="time" value={formNueva.hora_fin_prog}
                    onChange={e => setFormNueva(f => ({ ...f, hora_fin_prog: e.target.value }))}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              {/* Quirófano y tipo */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quirófano *</label>
                  <input required value={formNueva.quirofano}
                    onChange={e => setFormNueva(f => ({ ...f, quirofano: e.target.value }))}
                    placeholder="QX-1"
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Duración est. (min)</label>
                  <input type="number" min="15" value={formNueva.duracion_est_min}
                    onChange={e => setFormNueva(f => ({ ...f, duracion_est_min: e.target.value }))}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              {/* Procedimiento */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Cirugía / Procedimiento *</label>
                <input required value={formNueva.tipo_cirugia}
                  onChange={e => setFormNueva(f => ({ ...f, tipo_cirugia: e.target.value }))}
                  placeholder="Ej: Colecistectomía laparoscópica"
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Especialidad</label>
                  <input value={formNueva.especialidad}
                    onChange={e => setFormNueva(f => ({ ...f, especialidad: e.target.value }))}
                    placeholder="Cirugía General"
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CIE-10 (Pre-op)</label>
                  <input value={formNueva.cie10_pre}
                    onChange={e => setFormNueva(f => ({ ...f, cie10_pre: e.target.value }))}
                    placeholder="K80.2"
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              {/* Prioridad y anestesia */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prioridad *</label>
                  <select required value={formNueva.prioridad}
                    onChange={e => setFormNueva(f => ({ ...f, prioridad: e.target.value }))}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="ELECTIVA">Electiva</option>
                    <option value="URGENTE">Urgente</option>
                    <option value="EMERGENCIA">Emergencia</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo Anestesia *</label>
                  <select required value={formNueva.tipo_anestesia}
                    onChange={e => setFormNueva(f => ({ ...f, tipo_anestesia: e.target.value }))}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="GENERAL">General</option>
                    <option value="REGIONAL">Regional</option>
                    <option value="LOCAL">Local</option>
                    <option value="SEDACION">Sedación</option>
                    <option value="NINGUNA">Ninguna</option>
                  </select>
                </div>
              </div>

              {/* Cirujano y anestesiólogo */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cirujano *</label>
                  <select required value={formNueva.cirujano}
                    onChange={e => setFormNueva(f => ({ ...f, cirujano: e.target.value }))}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">— Seleccionar —</option>
                    {usuarios.map(u => (
                      <option key={u.usr_id} value={u.usr_id}>{u.full_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Anestesiólogo</label>
                  <select value={formNueva.anestesiologo}
                    onChange={e => setFormNueva(f => ({ ...f, anestesiologo: e.target.value }))}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">— Sin asignar —</option>
                    {usuarios.map(u => (
                      <option key={u.usr_id} value={u.usr_id}>{u.full_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Diagnóstico pre-op */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Diagnóstico pre-operatorio</label>
                <textarea rows={2} value={formNueva.diagnostico_preop}
                  onChange={e => setFormNueva(f => ({ ...f, diagnostico_preop: e.target.value }))}
                  placeholder="Diagnóstico pre-quirúrgico..."
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowNueva(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={submitting || !formNueva.paciente || !formNueva.cirujano}
                  className="px-5 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  {submitting ? 'Programando…' : 'Programar Cirugía'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════
          MODAL — Iniciar Cirugía
      ════════════════════════════════════════════════════ */}
      {showIniciar && selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">Iniciar Cirugía</h3>
              <button onClick={() => setShowIniciar(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <form onSubmit={handleIniciar} className="p-6 space-y-4">
              {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{error}</div>}
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-sm text-green-800 font-medium">{selected.tipo_cirugia}</p>
                <p className="text-xs text-green-600 mt-0.5">Paciente: {selected.paciente_nombre} · Qx: {selected.quirofano}</p>
              </div>
              <p className="text-sm text-gray-600">
                Se registrará la hora de inicio real en este momento. Confirme para continuar.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas adicionales (opcional)</label>
                <textarea rows={2} value={formIniciar.notas_preop_adicionales}
                  onChange={e => setFormIniciar(f => ({ ...f, notas_preop_adicionales: e.target.value }))}
                  placeholder="Preparación, observaciones de inicio..."
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowIniciar(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg">Cancelar</button>
                <button type="submit" disabled={submitting}
                  className="px-5 py-2 text-sm font-medium bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50">
                  {submitting ? 'Iniciando…' : '▶ Iniciar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════
          MODAL — Completar Cirugía
      ════════════════════════════════════════════════════ */}
      {showCompletar && selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">Completar Cirugía</h3>
              <button onClick={() => setShowCompletar(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <form onSubmit={handleCompletar} className="p-6 space-y-4">
              {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{error}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hallazgos intraoperatorios *</label>
                <textarea rows={3} required value={formCompletar.hallazgos}
                  onChange={e => setFormCompletar(f => ({ ...f, hallazgos: e.target.value }))}
                  placeholder="Describir hallazgos encontrados durante la cirugía..."
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Diagnóstico post-operatorio *</label>
                <input required value={formCompletar.diagnostico_postop}
                  onChange={e => setFormCompletar(f => ({ ...f, diagnostico_postop: e.target.value }))}
                  placeholder="Diagnóstico final confirmado..."
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CIE-10 (post-op)</label>
                  <input value={formCompletar.cie10_post}
                    onChange={e => setFormCompletar(f => ({ ...f, cie10_post: e.target.value }))}
                    placeholder="K80.0"
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Complicaciones</label>
                  <input value={formCompletar.complicaciones}
                    onChange={e => setFormCompletar(f => ({ ...f, complicaciones: e.target.value }))}
                    placeholder="Sin complicaciones / detallar..."
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas post-operatorias</label>
                <textarea rows={2} value={formCompletar.notas_postop}
                  onChange={e => setFormCompletar(f => ({ ...f, notas_postop: e.target.value }))}
                  placeholder="Indicaciones, cuidados post-quirúrgicos..."
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowCompletar(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg">Cancelar</button>
                <button type="submit" disabled={submitting}
                  className="px-5 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50">
                  {submitting ? 'Guardando…' : '✓ Completar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════
          MODAL — Cancelar / Suspender
      ════════════════════════════════════════════════════ */}
      {showFinalizar && selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">
                {showFinalizar === 'cancelar' ? '❌ Cancelar Cirugía' : '⚠️ Suspender Cirugía'}
              </h3>
              <button onClick={() => setShowFinalizar(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <form onSubmit={handleFinalizar} className="p-6 space-y-4">
              {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{error}</div>}
              <div className={`rounded-lg p-3 ${showFinalizar === 'cancelar' ? 'bg-red-50 border border-red-200' : 'bg-orange-50 border border-orange-200'}`}>
                <p className={`text-sm font-medium ${showFinalizar === 'cancelar' ? 'text-red-800' : 'text-orange-800'}`}>
                  {selected.tipo_cirugia}
                </p>
                <p className={`text-xs mt-0.5 ${showFinalizar === 'cancelar' ? 'text-red-600' : 'text-orange-600'}`}>
                  Paciente: {selected.paciente_nombre}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Motivo de {showFinalizar === 'cancelar' ? 'cancelación' : 'suspensión'} *
                </label>
                <textarea rows={3} required value={formMotivo.motivo}
                  onChange={e => setFormMotivo({ motivo: e.target.value })}
                  placeholder={showFinalizar === 'cancelar'
                    ? 'Razón de la cancelación (condición del paciente, recursos, etc.)...'
                    : 'Razón de la suspensión intraoperatoria (complicación, falta de recursos, etc.)...'}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none" />
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowFinalizar(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg">Volver</button>
                <button type="submit" disabled={submitting}
                  className={`px-5 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 transition-colors ${showFinalizar === 'cancelar' ? 'bg-red-600 hover:bg-red-700' : 'bg-orange-600 hover:bg-orange-700'}`}>
                  {submitting ? 'Procesando…' : showFinalizar === 'cancelar' ? '❌ Confirmar Cancelación' : '⚠ Confirmar Suspensión'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
