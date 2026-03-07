/**
 * HealthTech Solutions — M07 Laboratorio / Exámenes
 * Panel dividido: lista de órdenes (izquierda) + detalle + resultados (derecha)
 *
 * Máquina de estados:
 *   PENDIENTE → [procesar] → EN_PROCESO → [completar] → COMPLETADA
 *   PENDIENTE | EN_PROCESO → [cancelar] → CANCELADA
 *
 * ResultadoLab: cada examen tiene valor, unidad, rango referencia y
 * estado (NORMAL/ALTO/BAJO/CRITICO) con badge de color.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import api from '@/services/api'

// ────────────────────────────────────────────────────────────
// Tipos
// ────────────────────────────────────────────────────────────
interface Resultado {
  res_id: number
  nombre_examen: string
  valor: string
  unidad: string
  rango_min: string
  rango_max: string
  valor_referencia: string
  interpretacion: string
  estado_resultado: string
  estado_resultado_display: string
  created_at: string
}

interface OrdenLab {
  lab_id: number
  fecha_solicitud: string
  hora_solicitud_fmt: string
  prioridad: string
  prioridad_display: string
  tipo_muestra: string
  tipo_muestra_display: string
  grupo_examen: string
  examenes_solicitados: string
  estado: string
  estado_display: string
  paciente_nombre: string
  paciente_expediente: string
  medico_nombre: string
  laboratorista_nombre?: string
  total_resultados: number
  fecha_muestra?: string
  hora_muestra_fmt?: string
  fecha_resultado?: string
  hora_resultado_fmt?: string
  observaciones_clin?: string
  notas_laboratorio?: string
  motivo_cancelacion?: string
  resultados?: Resultado[]
  created_at?: string
}

interface Usuario { usr_id: number; full_name: string }
interface Paciente { pac_id: number; primer_nombre: string; primer_apellido: string; no_expediente: string }

interface ResultadoForm {
  nombre_examen: string
  valor: string
  unidad: string
  rango_min: string
  rango_max: string
  interpretacion: string
  estado_resultado: string
}

// ────────────────────────────────────────────────────────────
// Mapas de colores
// ────────────────────────────────────────────────────────────
const PRIORIDAD_COLORS: Record<string, string> = {
  NORMAL:     'bg-blue-100 text-blue-800 border border-blue-200',
  URGENTE:    'bg-orange-100 text-orange-800 border border-orange-200',
  EMERGENCIA: 'bg-red-100 text-red-800 border border-red-200',
}
const PRIORIDAD_DOT: Record<string, string> = {
  NORMAL: 'bg-blue-500', URGENTE: 'bg-orange-500', EMERGENCIA: 'bg-red-500',
}
const ESTADO_COLORS: Record<string, string> = {
  PENDIENTE:  'bg-yellow-100 text-yellow-800',
  EN_PROCESO: 'bg-blue-100 text-blue-800',
  COMPLETADA: 'bg-green-100 text-green-800',
  CANCELADA:  'bg-gray-100 text-gray-600',
}
const RESULTADO_COLORS: Record<string, string> = {
  NORMAL:   'bg-green-100 text-green-800',
  ALTO:     'bg-orange-100 text-orange-800',
  BAJO:     'bg-sky-100 text-sky-800',
  CRITICO:  'bg-red-100 text-red-800 font-semibold',
  PENDIENTE:'bg-gray-100 text-gray-600',
}

const EMPTY_RESULTADO: ResultadoForm = {
  nombre_examen: '', valor: '', unidad: '',
  rango_min: '', rango_max: '', interpretacion: '', estado_resultado: 'NORMAL',
}

// ────────────────────────────────────────────────────────────
// Componente principal
// ────────────────────────────────────────────────────────────
export default function LaboratoryPage() {
  const [ordenes, setOrdenes]       = useState<OrdenLab[]>([])
  const [total, setTotal]           = useState(0)
  const [loading, setLoading]       = useState(false)
  const [selected, setSelected]     = useState<OrdenLab | null>(null)

  // Filtros
  const [search, setSearch]         = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroPrioridad, setFiltroPrioridad] = useState('')
  const [soloActivos, setSoloActivos] = useState(false)

  // Recursos
  const [usuarios, setUsuarios]     = useState<Usuario[]>([])
  const [busquedaPac, setBusquedaPac] = useState('')
  const [pacSugs, setPacSugs]       = useState<Paciente[]>([])
  const pacDebounce                  = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Modales
  const [showNueva, setShowNueva]       = useState(false)
  const [showProcesar, setShowProcesar] = useState(false)
  const [showCompletar, setShowCompletar] = useState(false)
  const [showCancelar, setShowCancelar] = useState(false)

  // Forms
  const [formNueva, setFormNueva] = useState({
    paciente: '', medico_solic: '',
    fecha_solicitud: '', hora_solicitud: '',
    prioridad: 'NORMAL', tipo_muestra: 'SANGRE', grupo_examen: '',
    examenes_solicitados: '', observaciones_clin: '',
  })
  const [formProcesar, setFormProcesar] = useState({ laboratorista_id: '', notas_laboratorio: '' })
  const [resultadosForm, setResultadosForm] = useState<ResultadoForm[]>([{ ...EMPTY_RESULTADO }])
  const [notasCompletar, setNotasCompletar] = useState('')
  const [formCancelar, setFormCancelar] = useState({ motivo: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState('')

  // ────────────────────────────────────────────────────────
  // Data
  // ────────────────────────────────────────────────────────
  const cargarOrdenes = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (filtroEstado)    params.estado    = filtroEstado
      if (filtroPrioridad) params.prioridad = filtroPrioridad
      if (soloActivos)     params.activos   = '1'
      if (search)          params.search    = search
      const res = await api.get('/laboratory/', { params })
      setOrdenes(res.data.results ?? [])
      setTotal(res.data.count ?? 0)
    } catch { setOrdenes([]) }
    finally { setLoading(false) }
  }, [filtroEstado, filtroPrioridad, soloActivos, search])

  const cargarDetalle = async (id: number) => {
    try {
      const res = await api.get(`/laboratory/${id}/`)
      setSelected(res.data)
    } catch {/* ignore */}
  }

  useEffect(() => { cargarOrdenes() }, [cargarOrdenes])
  useEffect(() => {
    api.get('/auth/usuarios/?page_size=100').then(r => setUsuarios(r.data.results ?? [])).catch(() => {})
  }, [])

  // Debounce paciente
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
  // Handlers
  // ────────────────────────────────────────────────────────
  const resetNueva = () => {
    setFormNueva({ paciente: '', medico_solic: '', fecha_solicitud: '', hora_solicitud: '',
      prioridad: 'NORMAL', tipo_muestra: 'SANGRE', grupo_examen: '', examenes_solicitados: '', observaciones_clin: '' })
    setBusquedaPac(''); setPacSugs([]); setError('')
  }

  const handleCrear = async (e: React.FormEvent) => {
    e.preventDefault(); setSubmitting(true); setError('')
    try {
      await api.post('/laboratory/', {
        ...formNueva,
        paciente: parseInt(formNueva.paciente),
        medico_solic: parseInt(formNueva.medico_solic),
      })
      setShowNueva(false); resetNueva(); cargarOrdenes()
    } catch (err: unknown) {
      const e = err as { response?: { data?: Record<string, unknown> } }
      setError(JSON.stringify(e.response?.data ?? 'Error al crear la orden'))
    } finally { setSubmitting(false) }
  }

  const handleProcesar = async (e: React.FormEvent) => {
    e.preventDefault(); if (!selected) return
    setSubmitting(true); setError('')
    try {
      const payload: Record<string, unknown> = { notas_laboratorio: formProcesar.notas_laboratorio }
      if (formProcesar.laboratorista_id) payload.laboratorista_id = parseInt(formProcesar.laboratorista_id)
      const res = await api.post(`/laboratory/${selected.lab_id}/procesar/`, payload)
      setSelected(res.data); setShowProcesar(false)
      setFormProcesar({ laboratorista_id: '', notas_laboratorio: '' })
      cargarOrdenes()
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } }
      setError(e.response?.data?.detail ?? 'Error al procesar')
    } finally { setSubmitting(false) }
  }

  const handleCompletar = async (e: React.FormEvent) => {
    e.preventDefault(); if (!selected) return
    setSubmitting(true); setError('')
    try {
      const res = await api.post(`/laboratory/${selected.lab_id}/completar/`, {
        notas_laboratorio: notasCompletar,
        resultados: resultadosForm,
      })
      setSelected(res.data); setShowCompletar(false)
      setResultadosForm([{ ...EMPTY_RESULTADO }]); setNotasCompletar('')
      cargarOrdenes()
    } catch (err: unknown) {
      const e = err as { response?: { data?: Record<string, unknown> } }
      setError(JSON.stringify(e.response?.data ?? 'Error al completar'))
    } finally { setSubmitting(false) }
  }

  const handleCancelar = async (e: React.FormEvent) => {
    e.preventDefault(); if (!selected) return
    setSubmitting(true); setError('')
    try {
      const res = await api.post(`/laboratory/${selected.lab_id}/cancelar/`, formCancelar)
      setSelected(res.data); setShowCancelar(false)
      setFormCancelar({ motivo: '' }); cargarOrdenes()
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string; motivo?: string[] } } }
      setError(e.response?.data?.detail ?? e.response?.data?.motivo?.[0] ?? 'Error')
    } finally { setSubmitting(false) }
  }

  // Helpers para el form de resultados
  const addResultado = () => setResultadosForm(r => [...r, { ...EMPTY_RESULTADO }])
  const removeResultado = (i: number) => setResultadosForm(r => r.filter((_, idx) => idx !== i))
  const updateResultado = (i: number, field: keyof ResultadoForm, value: string) =>
    setResultadosForm(r => r.map((row, idx) => idx === i ? { ...row, [field]: value } : row))

  // ────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Laboratorio</h1>
          <p className="text-sm text-gray-500 mt-0.5">Módulo M07 — {total} orden{total !== 1 ? 'es' : ''}</p>
        </div>
        <button onClick={() => { resetNueva(); setShowNueva(true) }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          <span className="text-lg leading-none">+</span> Nueva Orden
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 mb-4 flex-wrap items-center">
        <div className="relative flex-1 min-w-48">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Paciente, examen, expediente..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Todos los estados</option>
          <option value="PENDIENTE">Pendiente</option>
          <option value="EN_PROCESO">En Proceso</option>
          <option value="COMPLETADA">Completada</option>
          <option value="CANCELADA">Cancelada</option>
        </select>
        <select value={filtroPrioridad} onChange={e => setFiltroPrioridad(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Toda prioridad</option>
          <option value="NORMAL">Normal</option>
          <option value="URGENTE">Urgente</option>
          <option value="EMERGENCIA">Emergencia</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
          <input type="checkbox" checked={soloActivos} onChange={e => setSoloActivos(e.target.checked)} className="rounded" />
          Solo activas
        </label>
      </div>

      {/* Split panel */}
      <div className="flex gap-4 flex-1 min-h-0 overflow-hidden">

        {/* Lista */}
        <div className="w-96 flex-shrink-0 flex flex-col overflow-hidden bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-3 py-2 border-b border-gray-100 text-xs font-medium text-gray-500 bg-gray-50">
            {loading ? 'Cargando…' : `${ordenes.length} orden${ordenes.length !== 1 ? 'es' : ''}`}
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
            {ordenes.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center h-full py-16 px-6 text-center">
                <span className="text-4xl mb-3">🧪</span>
                <p className="text-gray-500 text-sm">No hay órdenes que coincidan</p>
              </div>
            )}
            {ordenes.map(o => (
              <button key={o.lab_id} onClick={() => cargarDetalle(o.lab_id)}
                className={`w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors ${selected?.lab_id === o.lab_id ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''}`}>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-medium text-gray-900 text-sm truncate">{o.paciente_nombre}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${ESTADO_COLORS[o.estado] ?? ''}`}>
                    {o.estado_display}
                  </span>
                </div>
                <p className="text-xs text-gray-600 truncate mb-1">{o.examenes_solicitados}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${PRIORIDAD_COLORS[o.prioridad] ?? ''}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${PRIORIDAD_DOT[o.prioridad]}`} />
                    {o.prioridad_display}
                  </span>
                  <span className="text-xs text-gray-400">🗓 {o.fecha_solicitud}</span>
                  <span className="text-xs text-gray-400">🧪 {o.tipo_muestra_display}</span>
                  {o.total_resultados > 0 && (
                    <span className="text-xs text-gray-400">📊 {o.total_resultados} result.</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Detalle */}
        <div className="flex-1 overflow-y-auto">
          {!selected ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <span className="text-5xl mb-4">🧪</span>
              <p className="text-gray-500 font-medium">Seleccione una orden</p>
              <p className="text-gray-400 text-sm">Ver detalle y resultados</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-100 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{selected.paciente_nombre}</h2>
                  <p className="text-sm text-gray-500">
                    Exp. {selected.paciente_expediente} · LAB-{selected.lab_id}
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
                {/* Info de la orden */}
                <section>
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                    <span>📋</span> Orden de Laboratorio
                  </h3>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                    <div className="text-gray-500">Fecha/Hora:</div>
                    <div className="text-gray-900">{selected.fecha_solicitud} {selected.hora_solicitud_fmt}</div>
                    <div className="text-gray-500">Médico solicitante:</div>
                    <div className="text-gray-900 font-medium">{selected.medico_nombre}</div>
                    <div className="text-gray-500">Laboratorista:</div>
                    <div className="text-gray-900">{selected.laboratorista_nombre ?? '—'}</div>
                    <div className="text-gray-500">Muestra:</div>
                    <div className="text-gray-900">{selected.tipo_muestra_display}</div>
                    {selected.grupo_examen && <><div className="text-gray-500">Grupo:</div><div className="text-gray-900">{selected.grupo_examen}</div></>}
                  </div>
                  {/* Exámenes solicitados */}
                  <div className="mt-3">
                    <p className="text-xs font-medium text-gray-500 mb-1">Exámenes solicitados</p>
                    <div className="flex flex-wrap gap-1">
                      {selected.examenes_solicitados.split(',').map((ex, i) => (
                        <span key={i} className="text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2 py-0.5">
                          {ex.trim()}
                        </span>
                      ))}
                    </div>
                  </div>
                  {selected.observaciones_clin && (
                    <p className="mt-2 text-xs text-gray-600 bg-gray-50 rounded p-2">{selected.observaciones_clin}</p>
                  )}
                </section>

                {/* Toma de muestra */}
                {selected.fecha_muestra && (
                  <section>
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                      <span>🩸</span> Toma de Muestra
                    </h3>
                    <p className="text-sm text-gray-900">
                      {selected.fecha_muestra} a las {selected.hora_muestra_fmt}
                    </p>
                    {selected.notas_laboratorio && (
                      <p className="text-xs text-gray-600 bg-gray-50 rounded p-2 mt-1">{selected.notas_laboratorio}</p>
                    )}
                  </section>
                )}

                {/* Resultados */}
                {selected.resultados && selected.resultados.length > 0 && (
                  <section>
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                      <span>📊</span> Resultados
                      <span className="text-xs font-normal text-gray-400">
                        — {selected.fecha_resultado} {selected.hora_resultado_fmt}
                      </span>
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-gray-50 text-gray-500 text-left">
                            <th className="px-3 py-2 font-medium">Examen</th>
                            <th className="px-3 py-2 font-medium">Valor</th>
                            <th className="px-3 py-2 font-medium">Unidad</th>
                            <th className="px-3 py-2 font-medium">Referencia</th>
                            <th className="px-3 py-2 font-medium">Estado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {selected.resultados.map(r => (
                            <tr key={r.res_id} className={r.estado_resultado === 'CRITICO' ? 'bg-red-50' : ''}>
                              <td className="px-3 py-2 font-medium text-gray-900">{r.nombre_examen}</td>
                              <td className="px-3 py-2 text-gray-900 font-mono">{r.valor}</td>
                              <td className="px-3 py-2 text-gray-500">{r.unidad}</td>
                              <td className="px-3 py-2 text-gray-500">
                                {r.rango_min && r.rango_max
                                  ? `${r.rango_min} – ${r.rango_max}`
                                  : r.valor_referencia || '—'}
                              </td>
                              <td className="px-3 py-2">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${RESULTADO_COLORS[r.estado_resultado] ?? ''}`}>
                                  {r.estado_resultado_display}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {/* Interpretaciones */}
                    {selected.resultados.some(r => r.interpretacion) && (
                      <div className="mt-3 space-y-1">
                        {selected.resultados.filter(r => r.interpretacion).map(r => (
                          <p key={r.res_id} className="text-xs text-gray-600">
                            <span className="font-medium">{r.nombre_examen}:</span> {r.interpretacion}
                          </p>
                        ))}
                      </div>
                    )}
                  </section>
                )}

                {/* Cancelación */}
                {selected.estado === 'CANCELADA' && selected.motivo_cancelacion && (
                  <section className="bg-red-50 border border-red-100 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-red-700 mb-1">❌ Motivo de cancelación</h3>
                    <p className="text-sm text-red-800">{selected.motivo_cancelacion}</p>
                  </section>
                )}

                {/* Acciones */}
                <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                  {selected.estado === 'PENDIENTE' && (
                    <>
                      <button onClick={() => { setShowProcesar(true); setError('') }}
                        className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
                        🩸 Procesar Muestra
                      </button>
                      <button onClick={() => { setShowCancelar(true); setFormCancelar({ motivo: '' }); setError('') }}
                        className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors">
                        ✕ Cancelar
                      </button>
                    </>
                  )}
                  {selected.estado === 'EN_PROCESO' && (
                    <>
                      <button onClick={() => { setShowCompletar(true); setResultadosForm([{ ...EMPTY_RESULTADO }]); setNotasCompletar(''); setError('') }}
                        className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors">
                        📊 Ingresar Resultados
                      </button>
                      <button onClick={() => { setShowCancelar(true); setFormCancelar({ motivo: '' }); setError('') }}
                        className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors">
                        ✕ Cancelar
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ════ MODAL: Nueva Orden ════ */}
      {showNueva && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">Nueva Orden de Laboratorio</h3>
              <button onClick={() => setShowNueva(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <form onSubmit={handleCrear} className="p-6 space-y-4">
              {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{error}</div>}

              {/* Paciente */}
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">Paciente *</label>
                <input value={busquedaPac} onChange={e => { setBusquedaPac(e.target.value); setFormNueva(f => ({ ...f, paciente: '' })) }}
                  placeholder="Buscar por nombre o expediente..."
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                {pacSugs.length > 0 && (
                  <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-40 overflow-y-auto">
                    {pacSugs.map(p => (
                      <button key={p.pac_id} type="button"
                        onClick={() => { setFormNueva(f => ({ ...f, paciente: String(p.pac_id) })); setBusquedaPac(`${p.primer_nombre} ${p.primer_apellido} (${p.no_expediente})`); setPacSugs([]) }}
                        className="w-full text-left px-4 py-2 text-sm hover:bg-blue-50">
                        {p.primer_nombre} {p.primer_apellido} · <span className="text-gray-500 font-mono">{p.no_expediente}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Médico */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Médico solicitante *</label>
                <select required value={formNueva.medico_solic} onChange={e => setFormNueva(f => ({ ...f, medico_solic: e.target.value }))}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">— Seleccionar —</option>
                  {usuarios.map(u => <option key={u.usr_id} value={u.usr_id}>{u.full_name}</option>)}
                </select>
              </div>

              {/* Fecha/Hora */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha *</label>
                  <input type="date" required value={formNueva.fecha_solicitud} onChange={e => setFormNueva(f => ({ ...f, fecha_solicitud: e.target.value }))}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hora *</label>
                  <input type="time" required value={formNueva.hora_solicitud} onChange={e => setFormNueva(f => ({ ...f, hora_solicitud: e.target.value }))}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              {/* Prioridad / Muestra */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prioridad *</label>
                  <select required value={formNueva.prioridad} onChange={e => setFormNueva(f => ({ ...f, prioridad: e.target.value }))}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="NORMAL">Normal</option>
                    <option value="URGENTE">Urgente</option>
                    <option value="EMERGENCIA">Emergencia</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de muestra *</label>
                  <select required value={formNueva.tipo_muestra} onChange={e => setFormNueva(f => ({ ...f, tipo_muestra: e.target.value }))}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="SANGRE">Sangre</option>
                    <option value="ORINA">Orina</option>
                    <option value="HECES">Heces</option>
                    <option value="ESPUTO">Esputo</option>
                    <option value="LCR">LCR</option>
                    <option value="TEJIDO">Tejido/Biopsia</option>
                    <option value="HISOPADO">Hisopado</option>
                    <option value="OTRO">Otro</option>
                  </select>
                </div>
              </div>

              {/* Exámenes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Exámenes solicitados * <span className="font-normal text-gray-400">(separados por coma)</span></label>
                <textarea rows={2} required value={formNueva.examenes_solicitados}
                  onChange={e => setFormNueva(f => ({ ...f, examenes_solicitados: e.target.value }))}
                  placeholder="Hemograma completo, Glucosa, Creatinina, PCR..."
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>

              {/* Observaciones */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones clínicas</label>
                <input value={formNueva.observaciones_clin} onChange={e => setFormNueva(f => ({ ...f, observaciones_clin: e.target.value }))}
                  placeholder="Contexto clínico relevante para el laboratorio..."
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowNueva(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg">Cancelar</button>
                <button type="submit" disabled={submitting || !formNueva.paciente}
                  className="px-5 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50">
                  {submitting ? 'Creando…' : 'Crear Orden'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════ MODAL: Procesar Muestra ════ */}
      {showProcesar && selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">🩸 Procesar Muestra</h3>
              <button onClick={() => setShowProcesar(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <form onSubmit={handleProcesar} className="p-6 space-y-4">
              {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{error}</div>}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm font-medium text-blue-800">{selected.paciente_nombre}</p>
                <p className="text-xs text-blue-600 mt-0.5">{selected.examenes_solicitados}</p>
              </div>
              <p className="text-sm text-gray-600">Se registrará la hora de toma de muestra en este momento.</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Laboratorista</label>
                <select value={formProcesar.laboratorista_id} onChange={e => setFormProcesar(f => ({ ...f, laboratorista_id: e.target.value }))}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">— Sin asignar —</option>
                  {usuarios.map(u => <option key={u.usr_id} value={u.usr_id}>{u.full_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas de laboratorio</label>
                <textarea rows={2} value={formProcesar.notas_laboratorio}
                  onChange={e => setFormProcesar(f => ({ ...f, notas_laboratorio: e.target.value }))}
                  placeholder="Tubo utilizado, condiciones, observaciones..."
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowProcesar(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg">Cancelar</button>
                <button type="submit" disabled={submitting}
                  className="px-5 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50">
                  {submitting ? 'Procesando…' : '🩸 Confirmar Toma'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════ MODAL: Ingresar Resultados ════ */}
      {showCompletar && selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">📊 Ingresar Resultados</h3>
              <button onClick={() => setShowCompletar(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <form onSubmit={handleCompletar} className="p-6 space-y-4">
              {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{error}</div>}

              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-sm font-medium text-green-800">{selected.paciente_nombre}</p>
                <p className="text-xs text-green-600 mt-0.5">{selected.examenes_solicitados}</p>
              </div>

              {/* Resultados dinámicos */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-700">Resultados *</p>
                  <button type="button" onClick={addResultado}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium">+ Agregar examen</button>
                </div>
                {resultadosForm.map((r, i) => (
                  <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-gray-600">Examen {i + 1}</p>
                      {resultadosForm.length > 1 && (
                        <button type="button" onClick={() => removeResultado(i)} className="text-xs text-red-500 hover:text-red-700">✕ Eliminar</button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="col-span-2">
                        <input required value={r.nombre_examen} onChange={e => updateResultado(i, 'nombre_examen', e.target.value)}
                          placeholder="Nombre del examen (ej: Hemoglobina)"
                          className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      </div>
                      <input required value={r.valor} onChange={e => updateResultado(i, 'valor', e.target.value)}
                        placeholder="Valor (ej: 8.5)"
                        className="text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      <input value={r.unidad} onChange={e => updateResultado(i, 'unidad', e.target.value)}
                        placeholder="Unidad (ej: g/dL)"
                        className="text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      <input value={r.rango_min} onChange={e => updateResultado(i, 'rango_min', e.target.value)}
                        placeholder="Ref. mínimo"
                        className="text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      <input value={r.rango_max} onChange={e => updateResultado(i, 'rango_max', e.target.value)}
                        placeholder="Ref. máximo"
                        className="text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      <select value={r.estado_resultado} onChange={e => updateResultado(i, 'estado_resultado', e.target.value)}
                        className="text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500">
                        <option value="NORMAL">Normal</option>
                        <option value="ALTO">Alto</option>
                        <option value="BAJO">Bajo</option>
                        <option value="CRITICO">Crítico ⚠</option>
                      </select>
                      <input value={r.interpretacion} onChange={e => updateResultado(i, 'interpretacion', e.target.value)}
                        placeholder="Interpretación (opcional)"
                        className="text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    </div>
                  </div>
                ))}
              </div>

              {/* Notas finales */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas finales</label>
                <textarea rows={2} value={notasCompletar} onChange={e => setNotasCompletar(e.target.value)}
                  placeholder="Observaciones finales del laboratorio..."
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>

              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowCompletar(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg">Cancelar</button>
                <button type="submit" disabled={submitting}
                  className="px-5 py-2 text-sm font-medium bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50">
                  {submitting ? 'Guardando…' : '✓ Completar Orden'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════ MODAL: Cancelar ════ */}
      {showCancelar && selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">❌ Cancelar Orden</h3>
              <button onClick={() => setShowCancelar(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <form onSubmit={handleCancelar} className="p-6 space-y-4">
              {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{error}</div>}
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm font-medium text-red-800">{selected.paciente_nombre}</p>
                <p className="text-xs text-red-600 mt-0.5">{selected.examenes_solicitados}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Motivo de cancelación *</label>
                <textarea rows={3} required value={formCancelar.motivo} onChange={e => setFormCancelar({ motivo: e.target.value })}
                  placeholder="Razón de la cancelación..."
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none" />
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowCancelar(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg">Volver</button>
                <button type="submit" disabled={submitting}
                  className="px-5 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50">
                  {submitting ? 'Cancelando…' : '❌ Confirmar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
