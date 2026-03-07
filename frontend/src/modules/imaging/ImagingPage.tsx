/**
 * HealthTech Solutions — PACS: Gestión de Imagen Médica
 * Módulo de estudios radiológicos (RX, CT, MRI, Ecografía, etc.)
 * Imágenes DICOM almacenadas en AWS S3; solo metadatos aquí.
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import { useAppSelector } from '../../shared/hooks/useStore'
import api from '../../services/api'

// ---- Tipos ----
interface Estudio {
  est_id: number
  modalidad: string
  modalidad_display: string
  region_anatomica: string
  region_display: string
  descripcion_clinica: string
  estado: 'SOLICITADO' | 'EN_PROCESO' | 'COMPLETADO' | 'CANCELADO'
  estado_display: string
  prioridad: 'NORMAL' | 'URGENTE' | 'EMERGENCIA'
  prioridad_display: string
  fecha_solicitud: string
  fecha_realizacion: string | null
  fecha_informe: string | null
  num_imagenes: number
  tiene_imagenes: boolean
  tiene_informe: boolean
  paciente_nombre: string
  paciente_expediente: string
  medico_nombre: string
}

interface EstudioDetail extends Estudio {
  hospital_id: number
  s3_bucket: string
  s3_prefix: string
  informe: string
  motivo_cancelacion: string
  tecnico_nombre: string | null
  radiologo_nombre: string | null
  created_at: string
  updated_at: string
}

// ---- Colores por estado ----
const ESTADO_COLORS: Record<string, string> = {
  SOLICITADO: 'bg-blue-100 text-blue-800',
  EN_PROCESO:  'bg-yellow-100 text-yellow-800',
  COMPLETADO:  'bg-green-100 text-green-800',
  CANCELADO:   'bg-red-100 text-red-800',
}

const PRIORIDAD_COLORS: Record<string, string> = {
  NORMAL:     'bg-gray-100 text-gray-700',
  URGENTE:    'bg-orange-100 text-orange-800',
  EMERGENCIA: 'bg-red-100 text-red-800',
}

const MODALIDAD_ICONS: Record<string, string> = {
  XRAY:          '🩻',
  CT:            '🧠',
  MRI:           '🔬',
  ULTRASONIDO:   '📡',
  MAMMOGRAFIA:   '🔵',
  PET:           '☢️',
  ANGIOGRAFIA:   '🫀',
  FLUOROSCOPIA:  '📺',
  DENSITOMETRIA: '🦴',
  OTRO:          '🏥',
}

// ---- Componente principal ----
export default function ImagingPage() {
  const { user } = useAppSelector((s) => s.auth)

  // Lista
  const [estudios, setEstudios]       = useState<Estudio[]>([])
  const [loading, setLoading]         = useState(false)
  const [search, setSearch]           = useState('')
  const [filterEstado, setFilterEstado] = useState('')
  const [filterModalidad, setFilterModalidad] = useState('')
  const [nextUrl, setNextUrl]         = useState<string | null>(null)

  // Detalle
  const [selected, setSelected]       = useState<EstudioDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  // Modal nuevo estudio
  const [showModal, setShowModal]     = useState(false)

  // Modal informe
  const [showInforme, setShowInforme] = useState(false)
  const [informe, setInforme]         = useState('')
  const [savingAction, setSavingAction] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ---- Fetch lista ----
  const fetchEstudios = useCallback(async (reset = true) => {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (search)        params.search    = search
      if (filterEstado)  params.estado    = filterEstado
      if (filterModalidad) params.modalidad = filterModalidad

      const url = reset ? '/imaging/estudios/' : (nextUrl ?? '/imaging/estudios/')
      const r = await api.get(url, { params: reset ? params : undefined })
      const data = r.data

      if (reset) {
        setEstudios(data.results ?? data)
      } else {
        setEstudios((prev) => [...prev, ...(data.results ?? data)])
      }
      setNextUrl(data.next ?? null)
    } catch {
      // error silencioso — mantenemos lista anterior
    } finally {
      setLoading(false)
    }
  }, [search, filterEstado, filterModalidad, nextUrl])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchEstudios(true), 400)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [search, filterEstado, filterModalidad])

  // ---- Fetch detalle ----
  const fetchDetail = async (id: number) => {
    setLoadingDetail(true)
    try {
      const r = await api.get(`/imaging/estudios/${id}/`)
      setSelected(r.data)
    } finally {
      setLoadingDetail(false)
    }
  }

  // ---- Acción: iniciar ----
  const handleIniciar = async () => {
    if (!selected) return
    setSavingAction(true)
    try {
      await api.post(`/imaging/estudios/${selected.est_id}/iniciar/`)
      await fetchDetail(selected.est_id)
      fetchEstudios(true)
    } finally {
      setSavingAction(false)
    }
  }

  // ---- Acción: cancelar ----
  const handleCancelar = async () => {
    if (!selected) return
    const motivo = prompt('Motivo de cancelación:')
    if (!motivo?.trim()) return
    setSavingAction(true)
    try {
      await api.post(`/imaging/estudios/${selected.est_id}/cancelar/`, {
        motivo_cancelacion: motivo,
      })
      await fetchDetail(selected.est_id)
      fetchEstudios(true)
    } finally {
      setSavingAction(false)
    }
  }

  // ---- Acción: guardar informe ----
  const handleGuardarInforme = async () => {
    if (!selected || !informe.trim()) return
    setSavingAction(true)
    try {
      await api.post(`/imaging/estudios/${selected.est_id}/informe/`, { informe })
      setShowInforme(false)
      setInforme('')
      await fetchDetail(selected.est_id)
      fetchEstudios(true)
    } finally {
      setSavingAction(false)
    }
  }

  const isMedico = user?.rol === 'MEDICO' || user?.rol === 'SUPER_ADMIN' || user?.rol === 'ADMIN_HOSPITAL'

  return (
    <div className="flex h-full gap-4 p-4">

      {/* ── Panel izquierdo: lista ── */}
      <div className="flex w-80 flex-shrink-0 flex-col gap-3">

        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-900">Imagen Médica</h1>
          {isMedico && (
            <button
              onClick={() => setShowModal(true)}
              className="rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700"
            >
              + Nuevo
            </button>
          )}
        </div>

        {/* Buscador */}
        <input
          type="text"
          placeholder="Buscar paciente, médico..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />

        {/* Filtros */}
        <div className="flex gap-2">
          <select
            value={filterEstado}
            onChange={(e) => setFilterEstado(e.target.value)}
            className="flex-1 rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:outline-none"
          >
            <option value="">Todos los estados</option>
            <option value="SOLICITADO">Solicitado</option>
            <option value="EN_PROCESO">En Proceso</option>
            <option value="COMPLETADO">Completado</option>
            <option value="CANCELADO">Cancelado</option>
          </select>
          <select
            value={filterModalidad}
            onChange={(e) => setFilterModalidad(e.target.value)}
            className="flex-1 rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:outline-none"
          >
            <option value="">Toda modalidad</option>
            <option value="XRAY">Rayos X</option>
            <option value="CT">CT / TAC</option>
            <option value="MRI">RMN</option>
            <option value="ULTRASONIDO">Ultrasonido</option>
            <option value="MAMMOGRAFIA">Mamografía</option>
            <option value="OTRO">Otro</option>
          </select>
        </div>

        {/* Lista de estudios */}
        <div className="flex-1 overflow-y-auto space-y-2">
          {loading && estudios.length === 0 && (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
            </div>
          )}
          {!loading && estudios.length === 0 && (
            <p className="py-8 text-center text-sm text-gray-500">No se encontraron estudios.</p>
          )}
          {estudios.map((est) => (
            <button
              key={est.est_id}
              onClick={() => fetchDetail(est.est_id)}
              className={`w-full rounded-xl border p-3 text-left transition hover:border-primary-400 hover:bg-primary-50 ${
                selected?.est_id === est.est_id
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-200 bg-white'
              }`}
            >
              {/* Primera línea: ícono modalidad + paciente */}
              <div className="flex items-center justify-between">
                <span className="text-base">{MODALIDAD_ICONS[est.modalidad] ?? '🏥'}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ESTADO_COLORS[est.estado]}`}>
                  {est.estado_display}
                </span>
              </div>
              <p className="mt-1 font-medium text-gray-900 text-sm truncate">{est.paciente_nombre}</p>
              <p className="text-xs text-gray-500 truncate">{est.paciente_expediente}</p>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-xs text-gray-600">{est.modalidad_display}</span>
                <span className="text-gray-300">·</span>
                <span className="text-xs text-gray-500">{est.region_display}</span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-xs text-gray-400">{est.fecha_solicitud}</span>
                {est.prioridad !== 'NORMAL' && (
                  <span className={`rounded-full px-1.5 py-0.5 text-xs font-medium ${PRIORIDAD_COLORS[est.prioridad]}`}>
                    {est.prioridad_display}
                  </span>
                )}
                {est.tiene_imagenes && (
                  <span className="text-xs text-gray-400">📷 {est.num_imagenes}</span>
                )}
              </div>
            </button>
          ))}

          {/* Cargar más */}
          {nextUrl && (
            <button
              onClick={() => fetchEstudios(false)}
              disabled={loading}
              className="w-full rounded-lg border border-gray-200 py-2 text-sm text-gray-500 hover:bg-gray-50"
            >
              {loading ? 'Cargando...' : 'Cargar más'}
            </button>
          )}
        </div>
      </div>

      {/* ── Panel derecho: detalle ── */}
      <div className="flex-1 overflow-y-auto rounded-2xl border border-gray-200 bg-white p-6">
        {loadingDetail && (
          <div className="flex h-full items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
          </div>
        )}

        {!loadingDetail && !selected && (
          <div className="flex h-full flex-col items-center justify-center text-gray-400">
            <span className="text-5xl">🩻</span>
            <p className="mt-4 text-lg font-medium">Selecciona un estudio</p>
            <p className="text-sm">Los detalles del estudio aparecerán aquí</p>
          </div>
        )}

        {!loadingDetail && selected && (
          <div className="space-y-6">

            {/* Header del detalle */}
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {MODALIDAD_ICONS[selected.modalidad]} {selected.modalidad_display}
                </h2>
                <p className="text-gray-600">{selected.paciente_nombre} · {selected.paciente_expediente}</p>
                <p className="text-sm text-gray-500">{selected.region_display}</p>
              </div>
              <div className="flex gap-2">
                <span className={`rounded-full px-3 py-1 text-sm font-medium ${ESTADO_COLORS[selected.estado]}`}>
                  {selected.estado_display}
                </span>
                {selected.prioridad !== 'NORMAL' && (
                  <span className={`rounded-full px-3 py-1 text-sm font-medium ${PRIORIDAD_COLORS[selected.prioridad]}`}>
                    {selected.prioridad_display}
                  </span>
                )}
              </div>
            </div>

            {/* Información del estudio */}
            <section>
              <h3 className="mb-3 font-semibold text-gray-700">Información del Estudio</h3>
              <div className="grid grid-cols-2 gap-4 rounded-xl bg-gray-50 p-4 text-sm">
                <div>
                  <p className="text-gray-500">Médico Solicitante</p>
                  <p className="font-medium">{selected.medico_nombre}</p>
                </div>
                <div>
                  <p className="text-gray-500">Técnico Radiólogo</p>
                  <p className="font-medium">{selected.tecnico_nombre ?? '—'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Radiólogo Informante</p>
                  <p className="font-medium">{selected.radiologo_nombre ?? '—'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Fecha Solicitud</p>
                  <p className="font-medium">{selected.fecha_solicitud}</p>
                </div>
                <div>
                  <p className="text-gray-500">Fecha Realización</p>
                  <p className="font-medium">{selected.fecha_realizacion ?? '—'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Fecha Informe</p>
                  <p className="font-medium">{selected.fecha_informe ?? '—'}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-gray-500">Descripción Clínica</p>
                  <p className="font-medium">{selected.descripcion_clinica}</p>
                </div>
              </div>
            </section>

            {/* Imágenes AWS S3 */}
            {selected.tiene_imagenes && (
              <section>
                <h3 className="mb-3 font-semibold text-gray-700">Imágenes ({selected.num_imagenes})</h3>
                <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm">
                  <p className="text-gray-500">📦 Bucket: <span className="font-mono text-gray-700">{selected.s3_bucket}</span></p>
                  <p className="text-gray-500 mt-1">🗂️ Ruta: <span className="font-mono text-gray-700">{selected.s3_prefix}</span></p>
                  <p className="mt-2 text-xs text-gray-400">
                    Las imágenes DICOM se acceden a través del visor PACS institucional usando las credenciales de AWS con ciclo de vida de retención.
                  </p>
                </div>
              </section>
            )}

            {/* Informe radiológico */}
            {selected.tiene_informe && (
              <section>
                <h3 className="mb-3 font-semibold text-gray-700">Informe Radiológico</h3>
                <div className="rounded-xl bg-blue-50 p-4 text-sm text-gray-700 whitespace-pre-wrap border border-blue-200">
                  {selected.informe}
                </div>
              </section>
            )}

            {/* Motivo cancelación */}
            {selected.estado === 'CANCELADO' && selected.motivo_cancelacion && (
              <section>
                <h3 className="mb-3 font-semibold text-gray-700">Motivo de Cancelación</h3>
                <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700 border border-red-200">
                  {selected.motivo_cancelacion}
                </p>
              </section>
            )}

            {/* Botones de acción */}
            {selected.estado !== 'COMPLETADO' && selected.estado !== 'CANCELADO' && (
              <section className="flex flex-wrap gap-3 border-t border-gray-100 pt-4">
                {selected.estado === 'SOLICITADO' && (
                  <button
                    onClick={handleIniciar}
                    disabled={savingAction}
                    className="rounded-lg bg-yellow-500 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-600 disabled:opacity-50"
                  >
                    Iniciar Estudio
                  </button>
                )}
                {(selected.estado === 'EN_PROCESO' || selected.estado === 'SOLICITADO') && isMedico && (
                  <button
                    onClick={() => { setShowInforme(true); setInforme(selected.informe ?? '') }}
                    disabled={savingAction}
                    className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                  >
                    Cargar Informe
                  </button>
                )}
                <button
                  onClick={handleCancelar}
                  disabled={savingAction}
                  className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  Cancelar
                </button>
              </section>
            )}

            {/* Auditoría */}
            <p className="text-xs text-gray-400">
              Creado: {new Date(selected.created_at).toLocaleString()} ·
              Actualizado: {new Date(selected.updated_at).toLocaleString()}
            </p>
          </div>
        )}
      </div>

      {/* ── Modal: nuevo estudio ── */}
      {showModal && (
        <NuevoEstudioModal
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); fetchEstudios(true) }}
        />
      )}

      {/* ── Modal: informe radiológico ── */}
      {showInforme && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-bold text-gray-900">Informe Radiológico</h2>
            <textarea
              rows={10}
              value={informe}
              onChange={(e) => setInforme(e.target.value)}
              placeholder="Escriba el informe radiológico aquí..."
              className="w-full rounded-lg border border-gray-300 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => setShowInforme(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleGuardarInforme}
                disabled={savingAction || !informe.trim()}
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {savingAction ? 'Guardando...' : 'Guardar Informe'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ---- Subcomponente: modal nuevo estudio ----
function NuevoEstudioModal({
  onClose, onSaved,
}: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    paciente_search: '',
    paciente_id: '',
    paciente_label: '',
    medico_sol: '',
    modalidad: '',
    region_anatomica: 'OTRO',
    descripcion_clinica: '',
    prioridad: 'NORMAL',
    fecha_solicitud: new Date().toISOString().slice(0, 10),
  })
  const [pacienteSuggestions, setPacienteSuggestions] = useState<
    { id: number; nombre: string; expediente: string }[]
  >([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Buscar paciente con debounce
  const handlePacienteSearch = (q: string) => {
    setForm((f) => ({ ...f, paciente_search: q, paciente_id: '', paciente_label: '' }))
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!q.trim()) { setPacienteSuggestions([]); return }
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await api.get('/patients/', { params: { search: q } })
        const results = r.data.results ?? r.data
        setPacienteSuggestions(
          results.map((p: { pac_id: number; primer_nombre: string; primer_apellido: string; no_expediente: string }) => ({
            id: p.pac_id,
            nombre: `${p.primer_nombre} ${p.primer_apellido}`,
            expediente: p.no_expediente,
          }))
        )
      } catch {
        setPacienteSuggestions([])
      }
    }, 400)
  }

  const selectPaciente = (p: { id: number; nombre: string; expediente: string }) => {
    setForm((f) => ({
      ...f,
      paciente_id: String(p.id),
      paciente_search: `${p.nombre} (${p.expediente})`,
      paciente_label: `${p.nombre} (${p.expediente})`,
    }))
    setPacienteSuggestions([])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.paciente_id) { setError('Seleccione un paciente de la lista.'); return }
    setSaving(true)
    setError('')
    try {
      await api.post('/imaging/estudios/', {
        paciente:            Number(form.paciente_id),
        medico_sol:          Number(form.medico_sol) || undefined,
        modalidad:           form.modalidad,
        region_anatomica:    form.region_anatomica,
        descripcion_clinica: form.descripcion_clinica,
        prioridad:           form.prioridad,
        fecha_solicitud:     form.fecha_solicitud,
      })
      onSaved()
    } catch (err: unknown) {
      const axErr = err as { response?: { data?: Record<string, string[]> } }
      const msgs = Object.values(axErr.response?.data ?? {}).flat()
      setError(msgs.join(' ') || 'Error al crear el estudio.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-bold text-gray-900">Nuevo Estudio de Imagen</h2>
        {error && <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Paciente */}
          <div className="relative">
            <label className="mb-1 block text-sm font-medium text-gray-700">Paciente *</label>
            <input
              type="text"
              value={form.paciente_search}
              onChange={(e) => handlePacienteSearch(e.target.value)}
              placeholder="Buscar por nombre o expediente..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            {pacienteSuggestions.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
                {pacienteSuggestions.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => selectPaciente(p)}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-primary-50"
                    >
                      {p.nombre} <span className="text-gray-500">— {p.expediente}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Modalidad + Región */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Modalidad *</label>
              <select
                required
                value={form.modalidad}
                onChange={(e) => setForm((f) => ({ ...f, modalidad: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">Seleccionar...</option>
                <option value="XRAY">Rayos X</option>
                <option value="CT">CT / TAC</option>
                <option value="MRI">Resonancia Magnética</option>
                <option value="ULTRASONIDO">Ultrasonido</option>
                <option value="MAMMOGRAFIA">Mamografía</option>
                <option value="PET">PET Scan</option>
                <option value="ANGIOGRAFIA">Angiografía</option>
                <option value="FLUOROSCOPIA">Fluoroscopía</option>
                <option value="DENSITOMETRIA">Densitometría</option>
                <option value="OTRO">Otro</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Región Anatómica</label>
              <select
                value={form.region_anatomica}
                onChange={(e) => setForm((f) => ({ ...f, region_anatomica: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="CRANEO">Cráneo / Cerebro</option>
                <option value="TORAX">Tórax</option>
                <option value="ABDOMEN">Abdomen</option>
                <option value="COLUMNA">Columna</option>
                <option value="EXTREMIDADES">Extremidades</option>
                <option value="PELVIS">Pelvis</option>
                <option value="CORAZON">Corazón</option>
                <option value="CUELLO">Cuello</option>
                <option value="MAMA">Mama</option>
                <option value="CUERPO_ENTERO">Cuerpo Entero</option>
                <option value="OTRO">Otro</option>
              </select>
            </div>
          </div>

          {/* Descripción clínica */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Descripción Clínica *</label>
            <textarea
              required
              rows={3}
              value={form.descripcion_clinica}
              onChange={(e) => setForm((f) => ({ ...f, descripcion_clinica: e.target.value }))}
              placeholder="Motivo clínico, síntomas relevantes..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Prioridad + Fecha */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Prioridad</label>
              <select
                value={form.prioridad}
                onChange={(e) => setForm((f) => ({ ...f, prioridad: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="NORMAL">Normal</option>
                <option value="URGENTE">Urgente</option>
                <option value="EMERGENCIA">Emergencia</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Fecha Solicitud *</label>
              <input
                type="date"
                required
                value={form.fecha_solicitud}
                onChange={(e) => setForm((f) => ({ ...f, fecha_solicitud: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          {/* Botones */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Crear Estudio'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
