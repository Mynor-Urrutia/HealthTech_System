/**
 * HealthTech Solutions — Módulo Encamamiento (M05)
 * Split-panel: lista izquierda / detalle derecha
 * Gestión de camas + admisiones hospitalarias
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import api from '@/services/api'

// ── Tipos ────────────────────────────────────────────────────
interface Cama {
  cama_id: number; numero_cama: string; piso: string; sala: string
  tipo_cama: string; tipo_cama_display: string
  estado: string; estado_display: string
  tiene_oxigeno: boolean; tiene_monitor: boolean; tiene_ventilador: boolean
}

interface Encamamiento {
  enc_id: number; fecha_ingreso: string; hora_ingreso_fmt: string
  motivo_ingreso: string; estado: string; estado_display: string
  paciente_nombre: string; paciente_expediente: string
  medico_nombre: string; cama_info: { numero: string; sala: string; piso: string; tipo: string }
  dias_estancia_calc: number; activo: boolean
}

interface EncamamientoDetalle extends Encamamiento {
  hospital_id: number; enfermero_nombre: string
  diagnostico_ingreso: string; cie10_ingreso: string
  notas_ingreso: string; evolucion: string; indicaciones: string
  tipo_egreso: string; tipo_egreso_display: string
  fecha_egreso: string | null; hora_egreso_fmt: string
  diagnostico_egreso: string; cie10_egreso: string; destino_egreso: string; dias_estancia: number | null
  created_at: string; updated_at: string
}

interface Paciente { pac_id: number; primer_nombre: string; primer_apellido: string; no_expediente: string }
interface Medico   { usr_id: number; primer_nombre: string; primer_apellido: string }

// ── Colores por estado ────────────────────────────────────────
const ESTADO_ENC_COLORS: Record<string, string> = {
  INGRESADO:      'bg-blue-100 text-blue-800',
  EN_TRATAMIENTO: 'bg-yellow-100 text-yellow-800',
  EGRESADO:       'bg-green-100 text-green-800',
  TRASLADADO:     'bg-teal-100 text-teal-800',
  FALLECIDO:      'bg-gray-200 text-gray-700',
}

const ESTADO_CAMA_COLORS: Record<string, string> = {
  DISPONIBLE:    'bg-green-100 text-green-700',
  OCUPADA:       'bg-red-100 text-red-700',
  RESERVADA:     'bg-yellow-100 text-yellow-700',
  MANTENIMIENTO: 'bg-gray-100 text-gray-600',
}

const ESTADO_ACTIVOS = ['INGRESADO', 'EN_TRATAMIENTO']

const FORM_INICIAL = {
  paciente: '', cama: '', medico: '', enfermero: '',
  fecha_ingreso: new Date().toISOString().split('T')[0],
  hora_ingreso: new Date().toTimeString().slice(0, 5),
  motivo_ingreso: '', diagnostico_ingreso: '', cie10_ingreso: '',
  notas_ingreso: '', indicaciones: '',
}

// ─────────────────────────────────────────────────────────────
export default function HospitalizationPage() {
  const [tab, setTab] = useState<'admisiones' | 'camas'>('admisiones')

  // Lista admisiones
  const [registros, setRegistros]     = useState<Encamamiento[]>([])
  const [cargando, setCargando]       = useState(false)
  const [pagSig, setPagSig]           = useState<string | null>(null)
  const [busqueda, setBusqueda]       = useState('')
  const [filtroEstado, setFiltroEst]  = useState('')
  const [soloActivos, setSoloActivos] = useState(false)

  // Lista camas
  const [camas, setCamas]           = useState<Cama[]>([])
  const [cargandoCamas, setCC]      = useState(false)
  const [filtroCamaEst, setFCE]     = useState('')

  // Detalle
  const [seleccionado, setSeleccionado] = useState<EncamamientoDetalle | null>(null)
  const [cargandoDet, setCargandoDet]   = useState(false)

  // Modales
  const [modalNueva, setModalNueva]   = useState(false)
  const [modalEvol, setModalEvol]     = useState(false)
  const [modalEgreso, setModalEgreso] = useState(false)

  // Formulario nueva admisión
  const [form, setForm]         = useState(FORM_INICIAL)
  const [guardando, setGuardando] = useState(false)
  const [errForm, setErrForm]     = useState<Record<string, string>>({})

  // Búsqueda paciente
  const [pacQuery, setPacQuery]    = useState('')
  const [pacRes, setPacRes]        = useState<Paciente[]>([])
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Recursos
  const [medicos, setMedicos]         = useState<Medico[]>([])
  const [camasDisp, setCamasDisp]     = useState<Cama[]>([])

  // Acciones
  const [formEvol, setFormEvol]   = useState({ evolucion: '', indicaciones: '' })
  const [formEgreso, setFormEgreso] = useState({
    tipo_egreso: 'ALTA_MEDICA', diagnostico_egreso: '', cie10_egreso: '',
    destino_egreso: '', notas_medico: '',
  })
  const [accionando, setAccionando] = useState(false)

  // ── Cargar admisiones ──────────────────────────────────────
  const cargarRegistros = useCallback(async (reset = true) => {
    setCargando(true)
    try {
      const params: Record<string, string> = { page_size: '20' }
      if (busqueda)     params.search = busqueda
      if (filtroEstado) params.estado = filtroEstado
      if (soloActivos)  params.activos = '1'
      const resp = await api.get('/hospitalization/', { params })
      const data = resp.data
      const lista = data.results ?? data
      setRegistros(reset ? lista : prev => [...prev, ...lista])
      setPagSig(data.next ?? null)
    } catch { /* silent */ }
    finally { setCargando(false) }
  }, [busqueda, filtroEstado, soloActivos])

  useEffect(() => { cargarRegistros() }, [cargarRegistros])

  // ── Cargar camas ───────────────────────────────────────────
  const cargarCamas = useCallback(async () => {
    setCC(true)
    try {
      const params: Record<string, string> = { page_size: '100' }
      if (filtroCamaEst) params.estado = filtroCamaEst
      const resp = await api.get('/hospitalization/camas/', { params })
      const lista = resp.data.results ?? resp.data
      setCamas(lista)
    } catch { /* silent */ }
    finally { setCC(false) }
  }, [filtroCamaEst])

  useEffect(() => { if (tab === 'camas') cargarCamas() }, [tab, cargarCamas])

  // ── Detalle ────────────────────────────────────────────────
  const abrirDetalle = async (id: number) => {
    setCargandoDet(true); setSeleccionado(null)
    try {
      const resp = await api.get(`/hospitalization/${id}/`)
      setSeleccionado(resp.data)
    } catch { /* silent */ }
    finally { setCargandoDet(false) }
  }

  // ── Recursos para modal ────────────────────────────────────
  const cargarRecursos = async () => {
    try {
      const [rm, rc] = await Promise.all([
        api.get('/auth/usuarios/', { params: { page_size: 100 } }),
        api.get('/hospitalization/camas/', { params: { disponibles: '1', page_size: 100 } }),
      ])
      setMedicos(rm.data.results ?? rm.data)
      setCamasDisp(rc.data.results ?? rc.data)
    } catch { /* silent */ }
  }

  // ── Búsqueda paciente ──────────────────────────────────────
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

  // ── Crear admisión ─────────────────────────────────────────
  const abrirModalNueva = () => {
    setForm(FORM_INICIAL); setPacQuery(''); setPacRes([]); setErrForm({})
    cargarRecursos(); setModalNueva(true)
  }

  const guardarAdmision = async () => {
    const errs: Record<string, string> = {}
    if (!form.paciente)       errs.paciente       = 'Seleccione un paciente.'
    if (!form.cama)           errs.cama           = 'Seleccione una cama.'
    if (!form.medico)         errs.medico         = 'Seleccione un médico tratante.'
    if (!form.motivo_ingreso) errs.motivo_ingreso = 'El motivo es requerido.'
    if (Object.keys(errs).length) { setErrForm(errs); return }

    setGuardando(true)
    try {
      const payload: Record<string, unknown> = {
        paciente: Number(form.paciente), cama: Number(form.cama),
        medico: Number(form.medico),
        fecha_ingreso: form.fecha_ingreso, hora_ingreso: form.hora_ingreso,
        motivo_ingreso: form.motivo_ingreso,
      }
      if (form.enfermero)         payload.enfermero         = Number(form.enfermero)
      if (form.diagnostico_ingreso) payload.diagnostico_ingreso = form.diagnostico_ingreso
      if (form.cie10_ingreso)     payload.cie10_ingreso     = form.cie10_ingreso
      if (form.notas_ingreso)     payload.notas_ingreso     = form.notas_ingreso
      if (form.indicaciones)      payload.indicaciones      = form.indicaciones

      await api.post('/hospitalization/', payload)
      setModalNueva(false)
      cargarRegistros(); cargarCamas()
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

  // ── Acción: tratamiento ────────────────────────────────────
  const iniciarTratamiento = async () => {
    if (!seleccionado) return
    setAccionando(true)
    try {
      const resp = await api.post(`/hospitalization/${seleccionado.enc_id}/tratamiento/`)
      setSeleccionado(resp.data); cargarRegistros()
    } catch { /* silent */ }
    finally { setAccionando(false) }
  }

  // ── Acción: evolución ──────────────────────────────────────
  const guardarEvolucion = async () => {
    if (!seleccionado) return
    setAccionando(true)
    try {
      const resp = await api.post(`/hospitalization/${seleccionado.enc_id}/evolucion/`, formEvol)
      setSeleccionado(resp.data); setModalEvol(false)
    } catch { /* silent */ }
    finally { setAccionando(false) }
  }

  // ── Acción: egreso ─────────────────────────────────────────
  const darEgreso = async () => {
    if (!seleccionado || !formEgreso.diagnostico_egreso) return
    setAccionando(true)
    try {
      const resp = await api.post(`/hospitalization/${seleccionado.enc_id}/egreso/`, formEgreso)
      setSeleccionado(resp.data); cargarRegistros(); cargarCamas(); setModalEgreso(false)
    } catch { /* silent */ }
    finally { setAccionando(false) }
  }

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="flex h-full gap-4">

      {/* ── Panel izquierdo ── */}
      <div className="w-96 flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex-shrink-0">

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          {(['admisiones', 'camas'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${tab === t ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {t === 'admisiones' ? 'Admisiones' : 'Camas'}
            </button>
          ))}
        </div>

        {tab === 'admisiones' ? (
          <>
            {/* Header admisiones */}
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h1 className="text-lg font-bold text-gray-900">Encamamiento</h1>
                  <p className="text-xs text-gray-500">{registros.length} admisión{registros.length !== 1 ? 'es' : ''}</p>
                </div>
                <button
                  onClick={abrirModalNueva}
                  className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Admitir
                </button>
              </div>
              <div className="relative mb-2">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                </svg>
                <input
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
                  placeholder="Paciente, médico, diagnóstico..."
                  value={busqueda}
                  onChange={e => setBusqueda(e.target.value)}
                />
              </div>
              <div className="flex gap-2 items-center">
                <select
                  className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-300"
                  value={filtroEstado}
                  onChange={e => setFiltroEst(e.target.value)}
                >
                  <option value="">Todos</option>
                  <option value="INGRESADO">Ingresado</option>
                  <option value="EN_TRATAMIENTO">En Tratamiento</option>
                  <option value="EGRESADO">Egresado</option>
                  <option value="TRASLADADO">Trasladado</option>
                </select>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input type="checkbox" checked={soloActivos} onChange={e => setSoloActivos(e.target.checked)} className="rounded text-blue-600" />
                  <span className="text-xs text-gray-600">Activos</span>
                </label>
              </div>
            </div>

            {/* Lista admisiones */}
            <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
              {cargando && registros.length === 0 ? (
                <div className="flex items-center justify-center h-32">
                  <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : registros.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-gray-400">
                  <svg className="w-10 h-10 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  <p className="text-sm">Sin admisiones</p>
                </div>
              ) : registros.map(r => (
                <button
                  key={r.enc_id}
                  onClick={() => abrirDetalle(r.enc_id)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${seleccionado?.enc_id === r.enc_id ? 'bg-blue-50 border-r-2 border-blue-500' : ''}`}
                >
                  <div className="flex items-start justify-between gap-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{r.paciente_nombre}</p>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${ESTADO_ENC_COLORS[r.estado] ?? 'bg-gray-100 text-gray-700'}`}>
                      {r.estado_display}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 truncate mt-0.5">{r.motivo_ingreso}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-400">{r.fecha_ingreso} {r.hora_ingreso_fmt}</span>
                    {r.cama_info?.numero && (
                      <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-mono">
                        🛏 {r.cama_info.numero}
                      </span>
                    )}
                    <span className="text-xs text-gray-400">{r.dias_estancia_calc}d</span>
                  </div>
                </button>
              ))}
              {pagSig && (
                <div className="p-3">
                  <button onClick={() => cargarRegistros(false)} disabled={cargando}
                    className="w-full py-2 text-xs text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50">
                    Cargar más
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Header camas */}
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <h1 className="text-lg font-bold text-gray-900">Camas</h1>
                <button onClick={cargarCamas} className="text-xs text-blue-600 hover:underline">Actualizar</button>
              </div>
              <select
                className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-300"
                value={filtroCamaEst}
                onChange={e => setFCE(e.target.value)}
              >
                <option value="">Todos los estados</option>
                <option value="DISPONIBLE">Disponibles</option>
                <option value="OCUPADA">Ocupadas</option>
                <option value="RESERVADA">Reservadas</option>
                <option value="MANTENIMIENTO">Mantenimiento</option>
              </select>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
              {cargandoCamas ? (
                <div className="flex items-center justify-center h-32">
                  <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : camas.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-gray-400">
                  <p className="text-sm">Sin camas registradas</p>
                </div>
              ) : camas.map(c => (
                <div key={c.cama_id} className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-gray-800">🛏 {c.numero_cama}</span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${ESTADO_CAMA_COLORS[c.estado] ?? 'bg-gray-100'}`}>
                        {c.estado_display}
                      </span>
                    </div>
                    <span className="text-xs text-gray-400">{c.tipo_cama_display}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{c.sala}{c.piso ? ` — Piso ${c.piso}` : ''}</p>
                  {(c.tiene_oxigeno || c.tiene_monitor || c.tiene_ventilador) && (
                    <div className="flex gap-1 mt-1">
                      {c.tiene_oxigeno    && <span className="text-[10px] bg-blue-50 text-blue-600 px-1 rounded">O₂</span>}
                      {c.tiene_monitor    && <span className="text-[10px] bg-green-50 text-green-600 px-1 rounded">Monitor</span>}
                      {c.tiene_ventilador && <span className="text-[10px] bg-purple-50 text-purple-600 px-1 rounded">Ventilador</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Panel derecho: detalle ── */}
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
        {cargandoDet ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !seleccionado ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <svg className="w-16 h-16 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <p className="text-sm font-medium">Seleccione una admisión</p>
            <p className="text-xs mt-1">Ver detalle del paciente encamado</p>
          </div>
        ) : (
          <div className="flex flex-col h-full overflow-y-auto">

            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{seleccionado.paciente_nombre}</h2>
                <p className="text-xs text-gray-500">
                  Exp: {seleccionado.paciente_expediente} · ENC-{seleccionado.enc_id}
                  {seleccionado.cama_info?.numero && ` · 🛏 ${seleccionado.cama_info.numero} — ${seleccionado.cama_info.sala}`}
                </p>
              </div>
              <span className={`text-xs font-semibold px-2 py-1 rounded-full ${ESTADO_ENC_COLORS[seleccionado.estado] ?? ''}`}>
                {seleccionado.estado_display}
              </span>
            </div>

            <div className="p-6 space-y-6 flex-1">

              {/* Admisión */}
              <section>
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Admisión
                </h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-gray-500">Fecha/Hora:</span> <span className="font-medium">{seleccionado.fecha_ingreso} {seleccionado.hora_ingreso_fmt}</span></div>
                  <div><span className="text-gray-500">Médico:</span> <span className="font-medium">{seleccionado.medico_nombre}</span></div>
                  <div><span className="text-gray-500">Enfermero:</span> <span className="font-medium">{seleccionado.enfermero_nombre}</span></div>
                  <div><span className="text-gray-500">Estancia:</span> <span className="font-medium">{seleccionado.dias_estancia_calc} día{seleccionado.dias_estancia_calc !== 1 ? 's' : ''}</span></div>
                  <div className="col-span-2"><span className="text-gray-500">Motivo:</span> <span className="font-medium">{seleccionado.motivo_ingreso}</span></div>
                  {seleccionado.diagnostico_ingreso && (
                    <div className="col-span-2">
                      <span className="text-gray-500">Dx ingreso:</span>
                      <span className="font-medium ml-1">{seleccionado.diagnostico_ingreso}</span>
                      {seleccionado.cie10_ingreso && <span className="font-mono text-blue-600 ml-1">({seleccionado.cie10_ingreso})</span>}
                    </div>
                  )}
                </div>
              </section>

              {/* Evolución e indicaciones */}
              {(seleccionado.evolucion || seleccionado.indicaciones || seleccionado.notas_ingreso) && (
                <section>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Notas Clínicas
                  </h3>
                  {seleccionado.notas_ingreso && (
                    <div className="mb-3">
                      <p className="text-xs text-gray-500 mb-1">Notas de ingreso</p>
                      <p className="text-sm text-gray-900 whitespace-pre-wrap bg-gray-50 rounded p-2">{seleccionado.notas_ingreso}</p>
                    </div>
                  )}
                  {seleccionado.evolucion && (
                    <div className="mb-3">
                      <p className="text-xs text-gray-500 mb-1">Evolución</p>
                      <p className="text-sm text-gray-900 whitespace-pre-wrap bg-gray-50 rounded p-2">{seleccionado.evolucion}</p>
                    </div>
                  )}
                  {seleccionado.indicaciones && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Indicaciones activas</p>
                      <p className="text-sm text-gray-900 whitespace-pre-wrap bg-yellow-50 border border-yellow-200 rounded p-2">{seleccionado.indicaciones}</p>
                    </div>
                  )}
                </section>
              )}

              {/* Egreso */}
              {seleccionado.tipo_egreso && (
                <section>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Egreso</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-gray-500">Tipo:</span> <span className="font-medium">{seleccionado.tipo_egreso_display}</span></div>
                    <div><span className="text-gray-500">Fecha/Hora:</span> <span className="font-medium">{seleccionado.fecha_egreso} {seleccionado.hora_egreso_fmt}</span></div>
                    <div><span className="text-gray-500">Días estancia:</span> <span className="font-medium">{seleccionado.dias_estancia}</span></div>
                    {seleccionado.diagnostico_egreso && (
                      <div className="col-span-2">
                        <span className="text-gray-500">Dx egreso:</span>
                        <span className="font-medium ml-1">{seleccionado.diagnostico_egreso}</span>
                        {seleccionado.cie10_egreso && <span className="font-mono text-blue-600 ml-1">({seleccionado.cie10_egreso})</span>}
                      </div>
                    )}
                    {seleccionado.destino_egreso && (
                      <div className="col-span-2"><span className="text-gray-500">Destino:</span> <span className="font-medium">{seleccionado.destino_egreso}</span></div>
                    )}
                  </div>
                </section>
              )}
            </div>

            {/* Botones de acción */}
            {ESTADO_ACTIVOS.includes(seleccionado.estado) && (
              <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex gap-2 flex-wrap">
                {seleccionado.estado === 'INGRESADO' && (
                  <button
                    onClick={iniciarTratamiento}
                    disabled={accionando}
                    className="px-4 py-2 bg-yellow-500 text-white text-sm font-medium rounded-lg hover:bg-yellow-600 disabled:opacity-50 transition-colors"
                  >
                    {accionando ? 'Procesando...' : 'Iniciar Tratamiento'}
                  </button>
                )}
                <button
                  onClick={() => { setFormEvol({ evolucion: '', indicaciones: '' }); setModalEvol(true) }}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Actualizar Evolución
                </button>
                <button
                  onClick={() => {
                    setFormEgreso({ tipo_egreso: 'ALTA_MEDICA', diagnostico_egreso: '', cie10_egreso: '', destino_egreso: '', notas_medico: '' })
                    setModalEgreso(true)
                  }}
                  className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                >
                  Dar de Alta / Egreso
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ══ Modal: Nueva Admisión ════════════════════════════ */}
      {modalNueva && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Nueva Admisión</h2>
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
                    className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 ${errForm.paciente ? 'border-red-400' : 'border-gray-200'}`}
                    placeholder="Buscar por nombre o expediente..."
                    value={pacQuery}
                    onChange={e => buscarPaciente(e.target.value)}
                  />
                  {pacRes.length > 0 && (
                    <ul className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                      {pacRes.map(p => (
                        <li key={p.pac_id}>
                          <button onClick={() => seleccionarPaciente(p)}
                            className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50">
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

              {/* Cama, médico y horario */}
              <fieldset className="border border-gray-200 rounded-lg p-4">
                <legend className="text-sm font-semibold text-gray-700 px-1">Asignación</legend>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Cama *</label>
                    <select
                      className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 ${errForm.cama ? 'border-red-400' : 'border-gray-200'}`}
                      value={form.cama}
                      onChange={e => setForm(f => ({ ...f, cama: e.target.value }))}
                    >
                      <option value="">Seleccione cama...</option>
                      {camasDisp.map(c => (
                        <option key={c.cama_id} value={c.cama_id}>
                          {c.numero_cama} — {c.sala} ({c.tipo_cama_display})
                        </option>
                      ))}
                    </select>
                    {errForm.cama && <p className="text-xs text-red-500 mt-1">{errForm.cama}</p>}
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Médico Tratante *</label>
                    <select
                      className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 ${errForm.medico ? 'border-red-400' : 'border-gray-200'}`}
                      value={form.medico}
                      onChange={e => setForm(f => ({ ...f, medico: e.target.value }))}
                    >
                      <option value="">Seleccione médico...</option>
                      {medicos.map(m => (
                        <option key={m.usr_id} value={m.usr_id}>{m.primer_nombre} {m.primer_apellido}</option>
                      ))}
                    </select>
                    {errForm.medico && <p className="text-xs text-red-500 mt-1">{errForm.medico}</p>}
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Fecha Ingreso</label>
                    <input type="date" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
                      value={form.fecha_ingreso} onChange={e => setForm(f => ({ ...f, fecha_ingreso: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Hora Ingreso</label>
                    <input type="time" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
                      value={form.hora_ingreso} onChange={e => setForm(f => ({ ...f, hora_ingreso: e.target.value }))} />
                  </div>
                </div>
              </fieldset>

              {/* Diagnóstico y motivo */}
              <fieldset className="border border-gray-200 rounded-lg p-4">
                <legend className="text-sm font-semibold text-gray-700 px-1">Diagnóstico</legend>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Motivo de Ingreso *</label>
                    <textarea rows={2}
                      className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none ${errForm.motivo_ingreso ? 'border-red-400' : 'border-gray-200'}`}
                      placeholder="Motivo de la hospitalización..."
                      value={form.motivo_ingreso}
                      onChange={e => setForm(f => ({ ...f, motivo_ingreso: e.target.value }))}
                    />
                    {errForm.motivo_ingreso && <p className="text-xs text-red-500 mt-1">{errForm.motivo_ingreso}</p>}
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <label className="text-xs text-gray-500 mb-1 block">Diagnóstico de ingreso</label>
                      <input className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
                        placeholder="Diagnóstico principal..."
                        value={form.diagnostico_ingreso}
                        onChange={e => setForm(f => ({ ...f, diagnostico_ingreso: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">CIE-10</label>
                      <input className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
                        placeholder="Ej: J18.9"
                        value={form.cie10_ingreso}
                        onChange={e => setForm(f => ({ ...f, cie10_ingreso: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Indicaciones iniciales</label>
                    <textarea rows={2}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
                      placeholder="Indicaciones médicas al ingreso..."
                      value={form.indicaciones}
                      onChange={e => setForm(f => ({ ...f, indicaciones: e.target.value }))} />
                  </div>
                </div>
              </fieldset>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-gray-100">
              <button onClick={() => setModalNueva(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
              <button onClick={guardarAdmision} disabled={guardando}
                className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {guardando ? 'Guardando...' : 'Admitir Paciente'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Modal: Evolución ════════════════════════════════ */}
      {modalEvol && seleccionado && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Actualizar Evolución</h2>
              <button onClick={() => setModalEvol(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Nota de evolución</label>
                <textarea rows={4} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
                  placeholder="Evolución del paciente..."
                  value={formEvol.evolucion}
                  onChange={e => setFormEvol(f => ({ ...f, evolucion: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Indicaciones actuales</label>
                <textarea rows={3} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
                  placeholder="Indicaciones médicas vigentes..."
                  value={formEvol.indicaciones}
                  onChange={e => setFormEvol(f => ({ ...f, indicaciones: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-gray-100">
              <button onClick={() => setModalEvol(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
              <button onClick={guardarEvolucion} disabled={accionando}
                className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {accionando ? 'Guardando...' : 'Guardar Evolución'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Modal: Egreso ════════════════════════════════════ */}
      {modalEgreso && seleccionado && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Egreso del Paciente</h2>
              <button onClick={() => setModalEgreso(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Tipo de Egreso *</label>
                  <select className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-300"
                    value={formEgreso.tipo_egreso}
                    onChange={e => setFormEgreso(f => ({ ...f, tipo_egreso: e.target.value }))}>
                    <option value="ALTA_MEDICA">Alta Médica</option>
                    <option value="VOLUNTARIA">Voluntaria</option>
                    <option value="TRASLADO">Traslado</option>
                    <option value="FUGA">Fuga</option>
                    <option value="FALLECIMIENTO">Fallecimiento</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">CIE-10 Egreso</label>
                  <input className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-300"
                    placeholder="Ej: J18.9"
                    value={formEgreso.cie10_egreso}
                    onChange={e => setFormEgreso(f => ({ ...f, cie10_egreso: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Diagnóstico de Egreso *</label>
                <input className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-300"
                  placeholder="Diagnóstico principal al egreso..."
                  value={formEgreso.diagnostico_egreso}
                  onChange={e => setFormEgreso(f => ({ ...f, diagnostico_egreso: e.target.value }))} />
              </div>
              {formEgreso.tipo_egreso === 'TRASLADO' && (
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Destino de Traslado</label>
                  <input className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-300"
                    placeholder="Ej: UCI, Cirugía, Hospital Central..."
                    value={formEgreso.destino_egreso}
                    onChange={e => setFormEgreso(f => ({ ...f, destino_egreso: e.target.value }))} />
                </div>
              )}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Notas de Egreso</label>
                <textarea rows={2} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-300 resize-none"
                  placeholder="Observaciones finales..."
                  value={formEgreso.notas_medico}
                  onChange={e => setFormEgreso(f => ({ ...f, notas_medico: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-gray-100">
              <button onClick={() => setModalEgreso(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
              <button onClick={darEgreso} disabled={accionando || !formEgreso.diagnostico_egreso}
                className="px-5 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50">
                {accionando ? 'Procesando...' : 'Confirmar Egreso'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
