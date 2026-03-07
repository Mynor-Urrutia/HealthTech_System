/**
 * HealthTech Solutions — Módulo Emergencias (M04)
 * Split-panel: lista izquierda / detalle derecha
 * Triaje Manchester + máquina de estados
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import api from '@/services/api'

// ── Tipos ────────────────────────────────────────────────────
interface Emergencia {
  emg_id: number
  fecha_ingreso: string
  hora_ingreso: string
  hora_ingreso_fmt: string
  nivel_triaje: string
  nivel_triaje_display: string
  motivo_consulta: string
  estado: string
  estado_display: string
  paciente_nombre: string
  paciente_expediente: string
  medico_nombre: string
  presion_display: string
  temperatura: number | null
  saturacion_o2: number | null
  frecuencia_cardiaca: number | null
  activo: boolean
}

interface EmergenciaDetalle extends Emergencia {
  hospital_id: number
  enfermero_nombre: string
  presion_sistolica: number | null
  presion_diastolica: number | null
  frecuencia_resp: number | null
  glucosa: number | null
  peso_kg: number | null
  diagnostico: string
  cie10_codigo: string
  tratamiento: string
  notas_medico: string
  notas_enfermero: string
  tipo_alta: string
  tipo_alta_display: string
  fecha_alta: string | null
  hora_alta_fmt: string
  destino_alta: string
  created_at: string
  updated_at: string
}

interface Paciente { pac_id: number; primer_nombre: string; primer_apellido: string; no_expediente: string }
interface Medico   { usr_id: number; primer_nombre: string; primer_apellido: string }

// ── Colores por triaje (Manchester) ──────────────────────────
const TRIAJE_COLORS: Record<string, string> = {
  ROJO:     'bg-red-600 text-white',
  NARANJA:  'bg-orange-500 text-white',
  AMARILLO: 'bg-yellow-400 text-gray-900',
  VERDE:    'bg-green-500 text-white',
  AZUL:     'bg-blue-400 text-white',
}
const TRIAJE_DOT: Record<string, string> = {
  ROJO:     'bg-red-500',
  NARANJA:  'bg-orange-400',
  AMARILLO: 'bg-yellow-400',
  VERDE:    'bg-green-500',
  AZUL:     'bg-blue-400',
}

// ── Colores por estado ────────────────────────────────────────
const ESTADO_COLORS: Record<string, string> = {
  ESPERA:      'bg-yellow-100 text-yellow-800',
  EN_ATENCION: 'bg-blue-100 text-blue-800',
  OBSERVACION: 'bg-purple-100 text-purple-800',
  ALTA:        'bg-green-100 text-green-800',
  TRANSFERIDO: 'bg-teal-100 text-teal-800',
  FALLECIDO:   'bg-gray-200 text-gray-700',
}

const ESTADO_ACTIVOS = ['ESPERA', 'EN_ATENCION', 'OBSERVACION']

// ── Helpers ──────────────────────────────────────────────────
const fmt = (v: number | null, unit: string) =>
  v != null ? `${v} ${unit}` : '—'

const FORM_INICIAL = {
  paciente: '',
  medico: '',
  enfermero: '',
  fecha_ingreso: new Date().toISOString().split('T')[0],
  hora_ingreso: new Date().toTimeString().slice(0, 5),
  motivo_consulta: '',
  nivel_triaje: 'AMARILLO',
  presion_sistolica: '',
  presion_diastolica: '',
  frecuencia_cardiaca: '',
  frecuencia_resp: '',
  temperatura: '',
  saturacion_o2: '',
  glucosa: '',
  peso_kg: '',
  notas_enfermero: '',
}

// ─────────────────────────────────────────────────────────────
export default function EmergencyPage() {
  // Lista
  const [registros, setRegistros]     = useState<Emergencia[]>([])
  const [cargando, setCargando]       = useState(false)
  const [pagSig, setPagSig]           = useState<string | null>(null)
  const [busqueda, setBusqueda]       = useState('')
  const [filtroEstado, setFiltroEst]  = useState('')
  const [filtroTriaje, setFiltroTrij] = useState('')
  const [soloActivos, setSoloActivos] = useState(false)

  // Detalle
  const [seleccionado, setSeleccionado] = useState<EmergenciaDetalle | null>(null)
  const [cargandoDet, setCargandoDet]   = useState(false)

  // Modales
  const [modalNueva, setModalNueva]       = useState(false)
  const [modalAtender, setModalAtender]   = useState(false)
  const [modalObserv, setModalObserv]     = useState(false)
  const [modalAlta, setModalAlta]         = useState(false)

  // Formulario nueva emergencia
  const [form, setForm]   = useState(FORM_INICIAL)
  const [guardando, setGuardando] = useState(false)
  const [errForm, setErrForm]     = useState<Record<string, string>>({})

  // Búsqueda paciente
  const [pacQuery, setPacQuery]       = useState('')
  const [pacResultados, setPacRes]    = useState<Paciente[]>([])
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Médicos
  const [medicos, setMedicos] = useState<Medico[]>([])

  // Acciones
  const [medAtencion, setMedAtencion] = useState('')
  const [notasObserv, setNotasObserv] = useState('')
  const [formAlta, setFormAlta]       = useState({
    tipo_alta: 'MEDICA', diagnostico: '', cie10_codigo: '',
    tratamiento: '', notas_medico: '', destino_alta: '',
  })
  const [accionando, setAccionando] = useState(false)

  // ── Cargar lista ───────────────────────────────────────────
  const cargarRegistros = useCallback(async (reset = true) => {
    setCargando(true)
    try {
      const params: Record<string, string> = { page_size: '20' }
      if (busqueda)     params.search       = busqueda
      if (filtroEstado) params.estado       = filtroEstado
      if (filtroTriaje) params.nivel_triaje = filtroTriaje
      if (soloActivos)  params.activos      = '1'

      const resp = await api.get('/emergency/', { params })
      const data = resp.data
      const lista = data.results ?? data
      setRegistros(reset ? lista : prev => [...prev, ...lista])
      setPagSig(data.next ?? null)
    } catch { /* silent */ }
    finally { setCargando(false) }
  }, [busqueda, filtroEstado, filtroTriaje, soloActivos])

  useEffect(() => { cargarRegistros() }, [cargarRegistros])

  // ── Cargar detalle ─────────────────────────────────────────
  const abrirDetalle = async (id: number) => {
    setCargandoDet(true)
    setSeleccionado(null)
    try {
      const resp = await api.get(`/emergency/${id}/`)
      setSeleccionado(resp.data)
    } catch { /* silent */ }
    finally { setCargandoDet(false) }
  }

  // ── Cargar médicos ─────────────────────────────────────────
  const cargarMedicos = async () => {
    try {
      const resp = await api.get('/auth/usuarios/', { params: { page_size: 100 } })
      const lista = resp.data.results ?? resp.data
      setMedicos(lista)
    } catch { /* silent */ }
  }

  // ── Búsqueda de paciente con debounce ──────────────────────
  const buscarPaciente = (q: string) => {
    setPacQuery(q)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!q.trim()) { setPacRes([]); return }
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await api.get('/patients/', { params: { search: q, page_size: 8 } })
        setPacRes(r.data.results ?? r.data)
      } catch { setPacRes([]) }
    }, 400)
  }

  const seleccionarPaciente = (p: Paciente) => {
    setPacQuery(`${p.primer_nombre} ${p.primer_apellido} — ${p.no_expediente}`)
    setPacRes([])
    setForm(f => ({ ...f, paciente: String(p.pac_id) }))
  }

  // ── Crear emergencia ───────────────────────────────────────
  const abrirModalNueva = () => {
    setForm(FORM_INICIAL)
    setPacQuery(''); setPacRes([])
    setErrForm({})
    cargarMedicos()
    setModalNueva(true)
  }

  const guardarEmergencia = async () => {
    const errs: Record<string, string> = {}
    if (!form.paciente)        errs.paciente        = 'Seleccione un paciente.'
    if (!form.motivo_consulta) errs.motivo_consulta = 'El motivo es requerido.'
    if (!form.nivel_triaje)    errs.nivel_triaje    = 'Seleccione el nivel de triaje.'
    if (Object.keys(errs).length) { setErrForm(errs); return }

    setGuardando(true)
    try {
      const payload: Record<string, unknown> = {
        paciente:        Number(form.paciente),
        fecha_ingreso:   form.fecha_ingreso,
        hora_ingreso:    form.hora_ingreso,
        motivo_consulta: form.motivo_consulta,
        nivel_triaje:    form.nivel_triaje,
        notas_enfermero: form.notas_enfermero,
      }
      if (form.medico)    payload.medico    = Number(form.medico)
      if (form.enfermero) payload.enfermero = Number(form.enfermero)
      const campos_vitales = [
        'presion_sistolica','presion_diastolica','frecuencia_cardiaca',
        'frecuencia_resp','saturacion_o2','glucosa',
      ] as const
      campos_vitales.forEach(c => { if (form[c]) payload[c] = Number(form[c]) })
      if (form.temperatura) payload.temperatura = parseFloat(form.temperatura)
      if (form.peso_kg)     payload.peso_kg     = parseFloat(form.peso_kg)

      await api.post('/emergency/', payload)
      setModalNueva(false)
      cargarRegistros()
    } catch (e: unknown) {
      const err = e as { response?: { data?: unknown } }
      const d = err.response?.data
      if (d && typeof d === 'object') {
        const mapped: Record<string, string> = {}
        Object.entries(d as Record<string, unknown>).forEach(([k, v]) => {
          mapped[k] = Array.isArray(v) ? String(v[0]) : String(v)
        })
        setErrForm(mapped)
      } else {
        setErrForm({ general: 'Error al guardar. Verifique los datos.' })
      }
    } finally { setGuardando(false) }
  }

  // ── Acción: Atender ────────────────────────────────────────
  const iniciarAtencion = async () => {
    if (!seleccionado || !medAtencion) return
    setAccionando(true)
    try {
      const resp = await api.post(`/emergency/${seleccionado.emg_id}/atender/`, { medico_id: Number(medAtencion) })
      setSeleccionado(resp.data)
      cargarRegistros()
      setModalAtender(false)
    } catch { /* silent */ }
    finally { setAccionando(false) }
  }

  // ── Acción: Observación ────────────────────────────────────
  const pasarObservacion = async () => {
    if (!seleccionado) return
    setAccionando(true)
    try {
      const resp = await api.post(`/emergency/${seleccionado.emg_id}/observacion/`, { notas_medico: notasObserv })
      setSeleccionado(resp.data)
      cargarRegistros()
      setModalObserv(false)
    } catch { /* silent */ }
    finally { setAccionando(false) }
  }

  // ── Acción: Alta ───────────────────────────────────────────
  const darAlta = async () => {
    if (!seleccionado || !formAlta.diagnostico) return
    setAccionando(true)
    try {
      const resp = await api.post(`/emergency/${seleccionado.emg_id}/alta/`, formAlta)
      setSeleccionado(resp.data)
      cargarRegistros()
      setModalAlta(false)
    } catch { /* silent */ }
    finally { setAccionando(false) }
  }

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="flex h-full gap-4">

      {/* ── Panel izquierdo: lista ── */}
      <div className="w-96 flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex-shrink-0">

        {/* Header */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-lg font-bold text-gray-900">Emergencias</h1>
              <p className="text-xs text-gray-500">{registros.length} registro{registros.length !== 1 ? 's' : ''}</p>
            </div>
            <button
              onClick={abrirModalNueva}
              className="flex items-center gap-1.5 px-3 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Nueva
            </button>
          </div>

          {/* Buscador */}
          <div className="relative mb-2">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-300"
              placeholder="Paciente, médico, diagnóstico..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
            />
          </div>

          {/* Filtros */}
          <div className="flex gap-2">
            <select
              className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-red-300"
              value={filtroEstado}
              onChange={e => setFiltroEst(e.target.value)}
            >
              <option value="">Todos los estados</option>
              <option value="ESPERA">En Espera</option>
              <option value="EN_ATENCION">En Atención</option>
              <option value="OBSERVACION">Observación</option>
              <option value="ALTA">Alta</option>
              <option value="TRANSFERIDO">Transferido</option>
              <option value="FALLECIDO">Fallecido</option>
            </select>
            <select
              className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-red-300"
              value={filtroTriaje}
              onChange={e => setFiltroTrij(e.target.value)}
            >
              <option value="">Triaje</option>
              <option value="ROJO">🔴 Rojo</option>
              <option value="NARANJA">🟠 Naranja</option>
              <option value="AMARILLO">🟡 Amarillo</option>
              <option value="VERDE">🟢 Verde</option>
              <option value="AZUL">🔵 Azul</option>
            </select>
          </div>

          {/* Toggle solo activos */}
          <label className="flex items-center gap-2 mt-2 cursor-pointer">
            <input
              type="checkbox"
              checked={soloActivos}
              onChange={e => setSoloActivos(e.target.checked)}
              className="rounded text-red-600"
            />
            <span className="text-xs text-gray-600">Solo activos (espera / atención / observación)</span>
          </label>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
          {cargando && registros.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : registros.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-gray-400">
              <svg className="w-10 h-10 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <p className="text-sm">Sin registros</p>
            </div>
          ) : (
            registros.map(r => (
              <button
                key={r.emg_id}
                onClick={() => abrirDetalle(r.emg_id)}
                className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${seleccionado?.emg_id === r.emg_id ? 'bg-red-50 border-r-2 border-red-500' : ''}`}
              >
                <div className="flex items-start gap-2">
                  <span className={`mt-1.5 w-2.5 h-2.5 rounded-full flex-shrink-0 ${TRIAJE_DOT[r.nivel_triaje] ?? 'bg-gray-400'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{r.paciente_nombre}</p>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${ESTADO_COLORS[r.estado] ?? 'bg-gray-100 text-gray-700'}`}>
                        {r.estado_display}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 truncate mt-0.5">{r.motivo_consulta}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-400">{r.fecha_ingreso} {r.hora_ingreso_fmt}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${TRIAJE_COLORS[r.nivel_triaje] ?? 'bg-gray-100'}`}>
                        {r.nivel_triaje_display.split(' — ')[0]}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            ))
          )}
          {pagSig && (
            <div className="p-3">
              <button
                onClick={() => cargarRegistros(false)}
                disabled={cargando}
                className="w-full py-2 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
              >
                Cargar más
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Panel derecho: detalle ── */}
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
        {cargandoDet ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !seleccionado ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <svg className="w-16 h-16 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-sm font-medium">Seleccione un registro</p>
            <p className="text-xs mt-1">Ver detalle del caso de emergencia</p>
          </div>
        ) : (
          <div className="flex flex-col h-full overflow-y-auto">

            {/* Header detalle */}
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className={`w-4 h-4 rounded-full flex-shrink-0 ${TRIAJE_DOT[seleccionado.nivel_triaje] ?? 'bg-gray-400'}`} />
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{seleccionado.paciente_nombre}</h2>
                  <p className="text-xs text-gray-500">Exp: {seleccionado.paciente_expediente} · EMG-{seleccionado.emg_id}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${TRIAJE_COLORS[seleccionado.nivel_triaje] ?? ''}`}>
                  {seleccionado.nivel_triaje_display}
                </span>
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${ESTADO_COLORS[seleccionado.estado] ?? ''}`}>
                  {seleccionado.estado_display}
                </span>
              </div>
            </div>

            <div className="p-6 space-y-6 flex-1">

              {/* Información de ingreso */}
              <section>
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Información de Ingreso
                </h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-gray-500">Fecha/Hora:</span> <span className="font-medium">{seleccionado.fecha_ingreso} {seleccionado.hora_ingreso_fmt}</span></div>
                  <div><span className="text-gray-500">Médico:</span> <span className="font-medium">{seleccionado.medico_nombre}</span></div>
                  <div><span className="text-gray-500">Enfermero:</span> <span className="font-medium">{seleccionado.enfermero_nombre}</span></div>
                  <div className="col-span-2"><span className="text-gray-500">Motivo:</span> <span className="font-medium">{seleccionado.motivo_consulta}</span></div>
                </div>
              </section>

              {/* Signos vitales */}
              <section>
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                  Signos Vitales
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Presión',  value: seleccionado.presion_display || '—' },
                    { label: 'FC',       value: fmt(seleccionado.frecuencia_cardiaca, 'lpm') },
                    { label: 'FR',       value: fmt(seleccionado.frecuencia_resp, 'rpm') },
                    { label: 'Temp.',    value: seleccionado.temperatura != null ? `${seleccionado.temperatura}°C` : '—' },
                    { label: 'SatO₂',   value: fmt(seleccionado.saturacion_o2, '%') },
                    { label: 'Glucosa', value: fmt(seleccionado.glucosa, 'mg/dL') },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-gray-50 rounded-lg p-2 text-center">
                      <p className="text-xs text-gray-500">{label}</p>
                      <p className="text-sm font-semibold text-gray-900 mt-0.5">{value}</p>
                    </div>
                  ))}
                </div>
              </section>

              {/* Diagnóstico y tratamiento */}
              {(seleccionado.diagnostico || seleccionado.tratamiento || seleccionado.notas_medico) && (
                <section>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Diagnóstico y Tratamiento
                  </h3>
                  {seleccionado.diagnostico && (
                    <div className="mb-2">
                      <p className="text-xs text-gray-500 mb-1">
                        Diagnóstico{seleccionado.cie10_codigo && <span className="font-mono text-blue-600 ml-1">({seleccionado.cie10_codigo})</span>}
                      </p>
                      <p className="text-sm text-gray-900">{seleccionado.diagnostico}</p>
                    </div>
                  )}
                  {seleccionado.tratamiento && (
                    <div className="mb-2">
                      <p className="text-xs text-gray-500 mb-1">Tratamiento</p>
                      <p className="text-sm text-gray-900 whitespace-pre-wrap">{seleccionado.tratamiento}</p>
                    </div>
                  )}
                  {seleccionado.notas_medico && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Notas médico</p>
                      <p className="text-sm text-gray-900 whitespace-pre-wrap">{seleccionado.notas_medico}</p>
                    </div>
                  )}
                </section>
              )}

              {/* Alta / Egreso */}
              {seleccionado.tipo_alta && (
                <section>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Alta / Egreso</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-gray-500">Tipo:</span> <span className="font-medium">{seleccionado.tipo_alta_display}</span></div>
                    <div><span className="text-gray-500">Fecha/Hora:</span> <span className="font-medium">{seleccionado.fecha_alta} {seleccionado.hora_alta_fmt}</span></div>
                    {seleccionado.destino_alta && (
                      <div className="col-span-2"><span className="text-gray-500">Destino:</span> <span className="font-medium">{seleccionado.destino_alta}</span></div>
                    )}
                  </div>
                </section>
              )}
            </div>

            {/* Botones de acción */}
            {ESTADO_ACTIVOS.includes(seleccionado.estado) && (
              <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex gap-2 flex-wrap">
                {seleccionado.estado === 'ESPERA' && (
                  <button
                    onClick={() => { cargarMedicos(); setMedAtencion(''); setModalAtender(true) }}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Iniciar Atención
                  </button>
                )}
                {seleccionado.estado === 'EN_ATENCION' && (
                  <button
                    onClick={() => { setNotasObserv(''); setModalObserv(true) }}
                    className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    Pasar a Observación
                  </button>
                )}
                {['EN_ATENCION', 'OBSERVACION'].includes(seleccionado.estado) && (
                  <button
                    onClick={() => {
                      setFormAlta({ tipo_alta: 'MEDICA', diagnostico: '', cie10_codigo: '', tratamiento: '', notas_medico: '', destino_alta: '' })
                      setModalAlta(true)
                    }}
                    className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Dar de Alta
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ══ Modal: Nueva Emergencia ══════════════════════════ */}
      {modalNueva && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Nueva Emergencia</h2>
              <button onClick={() => setModalNueva(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-5 space-y-5">
              {errForm.general && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{errForm.general}</p>}

              {/* Paciente */}
              <fieldset className="border border-gray-200 rounded-lg p-4">
                <legend className="text-sm font-semibold text-gray-700 px-1">Paciente</legend>
                <div className="relative">
                  <input
                    className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-300 ${errForm.paciente ? 'border-red-400' : 'border-gray-200'}`}
                    placeholder="Buscar por nombre o expediente..."
                    value={pacQuery}
                    onChange={e => buscarPaciente(e.target.value)}
                  />
                  {pacResultados.length > 0 && (
                    <ul className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                      {pacResultados.map(p => (
                        <li key={p.pac_id}>
                          <button
                            onClick={() => seleccionarPaciente(p)}
                            className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50"
                          >
                            <span className="font-medium">{p.primer_nombre} {p.primer_apellido}</span>
                            <span className="text-gray-500 ml-2">— {p.no_expediente}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {errForm.paciente && <p className="text-xs text-red-500 mt-1">{errForm.paciente}</p>}
                </div>
              </fieldset>

              {/* Triaje y Horario */}
              <fieldset className="border border-gray-200 rounded-lg p-4">
                <legend className="text-sm font-semibold text-gray-700 px-1">Triaje y Registro</legend>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Nivel de Triaje *</label>
                    <select
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-300"
                      value={form.nivel_triaje}
                      onChange={e => setForm(f => ({ ...f, nivel_triaje: e.target.value }))}
                    >
                      <option value="ROJO">🔴 Rojo — Inmediato</option>
                      <option value="NARANJA">🟠 Naranja — Muy urgente</option>
                      <option value="AMARILLO">🟡 Amarillo — Urgente</option>
                      <option value="VERDE">🟢 Verde — Poco urgente</option>
                      <option value="AZUL">🔵 Azul — No urgente</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Médico (opcional)</label>
                    <select
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-300"
                      value={form.medico}
                      onChange={e => setForm(f => ({ ...f, medico: e.target.value }))}
                    >
                      <option value="">Sin asignar</option>
                      {medicos.map(m => (
                        <option key={m.usr_id} value={m.usr_id}>{m.primer_nombre} {m.primer_apellido}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Fecha</label>
                    <input type="date" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-300"
                      value={form.fecha_ingreso} onChange={e => setForm(f => ({ ...f, fecha_ingreso: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Hora</label>
                    <input type="time" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-300"
                      value={form.hora_ingreso} onChange={e => setForm(f => ({ ...f, hora_ingreso: e.target.value }))} />
                  </div>
                </div>
                <div className="mt-3">
                  <label className="text-xs text-gray-500 mb-1 block">Motivo de Consulta *</label>
                  <textarea
                    rows={2}
                    className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-300 resize-none ${errForm.motivo_consulta ? 'border-red-400' : 'border-gray-200'}`}
                    placeholder="Describa el motivo de consulta..."
                    value={form.motivo_consulta}
                    onChange={e => setForm(f => ({ ...f, motivo_consulta: e.target.value }))}
                  />
                  {errForm.motivo_consulta && <p className="text-xs text-red-500 mt-1">{errForm.motivo_consulta}</p>}
                </div>
              </fieldset>

              {/* Signos vitales */}
              <fieldset className="border border-gray-200 rounded-lg p-4">
                <legend className="text-sm font-semibold text-gray-700 px-1">Signos Vitales (opcional)</legend>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { key: 'presion_sistolica',   label: 'P. Sistólica',   placeholder: 'mmHg' },
                    { key: 'presion_diastolica',  label: 'P. Diastólica',  placeholder: 'mmHg' },
                    { key: 'frecuencia_cardiaca', label: 'Frec. Cardíaca', placeholder: 'lpm'  },
                    { key: 'frecuencia_resp',     label: 'Frec. Resp.',    placeholder: 'rpm'  },
                    { key: 'temperatura',         label: 'Temperatura',    placeholder: '°C'   },
                    { key: 'saturacion_o2',       label: 'SatO₂',         placeholder: '%'    },
                    { key: 'glucosa',             label: 'Glucosa',        placeholder: 'mg/dL'},
                    { key: 'peso_kg',             label: 'Peso',           placeholder: 'kg'   },
                  ].map(({ key, label, placeholder }) => (
                    <div key={key}>
                      <label className="text-xs text-gray-500 mb-1 block">{label}</label>
                      <input
                        type="number"
                        step="any"
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-300"
                        placeholder={placeholder}
                        value={(form as Record<string, string>)[key]}
                        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                      />
                    </div>
                  ))}
                </div>
                {errForm.saturacion_o2 && <p className="text-xs text-red-500 mt-1">{errForm.saturacion_o2}</p>}
                {errForm.temperatura   && <p className="text-xs text-red-500 mt-1">{errForm.temperatura}</p>}
              </fieldset>

              {/* Notas enfermero */}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Notas de Triaje (enfermero)</label>
                <textarea
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
                  placeholder="Observaciones del triaje..."
                  value={form.notas_enfermero}
                  onChange={e => setForm(f => ({ ...f, notas_enfermero: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 p-5 border-t border-gray-100">
              <button onClick={() => setModalNueva(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
                Cancelar
              </button>
              <button
                onClick={guardarEmergencia}
                disabled={guardando}
                className="px-5 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {guardando ? 'Guardando...' : 'Registrar Emergencia'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Modal: Iniciar Atención ══════════════════════════ */}
      {modalAtender && seleccionado && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Iniciar Atención</h2>
              <button onClick={() => setModalAtender(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-5">
              <p className="text-sm text-gray-600 mb-4">
                Paciente: <strong>{seleccionado.paciente_nombre}</strong>
              </p>
              <label className="text-xs text-gray-500 mb-1 block">Médico responsable *</label>
              <select
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
                value={medAtencion}
                onChange={e => setMedAtencion(e.target.value)}
              >
                <option value="">Seleccione un médico...</option>
                {medicos.map(m => (
                  <option key={m.usr_id} value={m.usr_id}>{m.primer_nombre} {m.primer_apellido}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-gray-100">
              <button onClick={() => setModalAtender(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
              <button
                onClick={iniciarAtencion}
                disabled={accionando || !medAtencion}
                className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {accionando ? 'Procesando...' : 'Iniciar Atención'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Modal: Observación ══════════════════════════════ */}
      {modalObserv && seleccionado && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Pasar a Observación</h2>
              <button onClick={() => setModalObserv(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-5">
              <label className="text-xs text-gray-500 mb-1 block">Notas médico (opcional)</label>
              <textarea
                rows={3}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none"
                placeholder="Observaciones clínicas..."
                value={notasObserv}
                onChange={e => setNotasObserv(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-gray-100">
              <button onClick={() => setModalObserv(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
              <button
                onClick={pasarObservacion}
                disabled={accionando}
                className="px-5 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {accionando ? 'Procesando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Modal: Alta ═════════════════════════════════════ */}
      {modalAlta && seleccionado && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Dar de Alta</h2>
              <button onClick={() => setModalAlta(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Tipo de Alta *</label>
                  <select
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-300"
                    value={formAlta.tipo_alta}
                    onChange={e => setFormAlta(f => ({ ...f, tipo_alta: e.target.value }))}
                  >
                    <option value="MEDICA">Alta Médica</option>
                    <option value="VOLUNTARIA">Voluntaria</option>
                    <option value="TRANSFERENCIA">Transferencia</option>
                    <option value="FUGA">Fuga</option>
                    <option value="FALLECIMIENTO">Fallecimiento</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Código CIE-10</label>
                  <input
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-300"
                    placeholder="Ej: J18.9"
                    value={formAlta.cie10_codigo}
                    onChange={e => setFormAlta(f => ({ ...f, cie10_codigo: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Diagnóstico *</label>
                <input
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-300"
                  placeholder="Diagnóstico de egreso..."
                  value={formAlta.diagnostico}
                  onChange={e => setFormAlta(f => ({ ...f, diagnostico: e.target.value }))}
                />
              </div>
              {formAlta.tipo_alta === 'TRANSFERENCIA' && (
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Destino / Servicio *</label>
                  <input
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-300"
                    placeholder="Ej: UCI, Hospitalización piso 3..."
                    value={formAlta.destino_alta}
                    onChange={e => setFormAlta(f => ({ ...f, destino_alta: e.target.value }))}
                  />
                </div>
              )}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Tratamiento</label>
                <textarea rows={2}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-300 resize-none"
                  placeholder="Plan de tratamiento / indicaciones al alta..."
                  value={formAlta.tratamiento}
                  onChange={e => setFormAlta(f => ({ ...f, tratamiento: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Notas médico</label>
                <textarea rows={2}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-300 resize-none"
                  placeholder="Notas clínicas adicionales..."
                  value={formAlta.notas_medico}
                  onChange={e => setFormAlta(f => ({ ...f, notas_medico: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-gray-100">
              <button onClick={() => setModalAlta(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
              <button
                onClick={darAlta}
                disabled={accionando || !formAlta.diagnostico}
                className="px-5 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {accionando ? 'Procesando...' : 'Confirmar Alta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
