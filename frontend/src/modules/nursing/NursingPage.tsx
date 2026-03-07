import { useState, useEffect, useCallback, useRef } from 'react'
import api from '../../services/api'

// ============================================================
// Types
// ============================================================
interface Paciente {
  pac_id: number
  primer_nombre: string
  primer_apellido: string
  no_expediente: string
}

interface CamaInfo {
  numero: string
  sala: string
  piso: string
  tipo: string
}

interface Encamamiento {
  enc_id: number
  paciente: number
  paciente_nombre?: string
  paciente_expediente?: string
  motivo_ingreso?: string
  estado: string
  estado_display?: string
  cama_info?: CamaInfo
  medico_nombre?: string
}

interface SignoVital {
  sig_id: number
  paciente: number
  encamamiento: number | null
  temperatura: string | null
  presion_sistolica: number | null
  presion_diastolica: number | null
  presion_arterial: string | null
  frecuencia_cardiaca: number | null
  frecuencia_respiratoria: number | null
  saturacion_o2: string | null
  glucemia: string | null
  peso: string | null
  talla: string | null
  imc: number | null
  glasgow: number | null
  observaciones: string
  enfermera: string
  created_at: string
}

interface NotaEnfermeria {
  nota_id: number
  paciente: number
  tipo_nota: string
  tipo_nota_display: string
  contenido: string
  es_urgente: boolean
  enfermera: string
  created_at: string
}

type Tab = 'pacientes' | 'signos' | 'notas'
type RightTab = 'signos' | 'notas'
type ModalMode = 'signo' | 'nota' | null

// ============================================================
// Helpers
// ============================================================
function fmtDate(dt: string): string {
  if (!dt) return '—'
  return new Date(dt).toLocaleString('es-GT', { dateStyle: 'short', timeStyle: 'short' })
}

const TIPO_NOTA_CHOICES = [
  { value: 'EVOLUCION',     label: 'Evolución de Enfermería' },
  { value: 'PROCEDIMIENTO', label: 'Procedimiento' },
  { value: 'MEDICAMENTO',   label: 'Administración de Medicamento' },
  { value: 'INCIDENTE',     label: 'Incidente / Evento Adverso' },
  { value: 'INGRESO',       label: 'Nota de Ingreso' },
  { value: 'EGRESO',        label: 'Nota de Egreso' },
  { value: 'OTRO',          label: 'Otro' },
]

const TIPO_NOTA_STYLE: Record<string, string> = {
  EVOLUCION:     'bg-blue-100 text-blue-800',
  PROCEDIMIENTO: 'bg-purple-100 text-purple-800',
  MEDICAMENTO:   'bg-teal-100 text-teal-800',
  INCIDENTE:     'bg-red-100 text-red-800',
  INGRESO:       'bg-green-100 text-green-800',
  EGRESO:        'bg-orange-100 text-orange-800',
  OTRO:          'bg-gray-100 text-gray-700',
}

// ============================================================
// Main Component
// ============================================================
export default function NursingPage() {
  const [tab, setTab] = useState<Tab>('pacientes')

  // Encamamientos
  const [encamamientos, setEncamamientos] = useState<Encamamiento[]>([])
  const [encTotal, setEncTotal]           = useState(0)
  const [encLoading, setEncLoading]       = useState(false)
  const [encSearch, setEncSearch]         = useState('')
  const [selectedEnc, setSelectedEnc]     = useState<Encamamiento | null>(null)
  const [rightTab, setRightTab]           = useState<RightTab>('signos')

  // Signos / Notas del paciente seleccionado
  const [signos, setSignos]         = useState<SignoVital[]>([])
  const [signosLoad, setSignosLoad] = useState(false)
  const [notas, setNotas]           = useState<NotaEnfermeria[]>([])
  const [notasLoad, setNotasLoad]   = useState(false)

  // Paciente search for global tabs
  const [pacSearch, setPacSearch]         = useState('')
  const [pacResults, setPacResults]       = useState<Paciente[]>([])
  const [pacSearchLoad, setPacSearchLoad] = useState(false)
  const [selectedPac, setSelectedPac]     = useState<Paciente | null>(null)

  // All signos / notas (global tabs)
  const [allSignos, setAllSignos]           = useState<SignoVital[]>([])
  const [allSignosTotal, setAllSignosTotal] = useState(0)
  const [allSignosLoad, setAllSignosLoad]   = useState(false)
  const [allNotas, setAllNotas]             = useState<NotaEnfermeria[]>([])
  const [allNotasTotal, setAllNotasTotal]   = useState(0)
  const [allNotasLoad, setAllNotasLoad]     = useState(false)

  // Modal
  const [modalMode, setModalMode] = useState<ModalMode>(null)
  const [saving, setSaving]       = useState(false)
  const [modalErr, setModalErr]   = useState('')

  // Signo form fields
  const [fTemp, setFTemp]       = useState('')
  const [fSist, setFSist]       = useState('')
  const [fDias, setFDias]       = useState('')
  const [fFC, setFFC]           = useState('')
  const [fFR, setFFR]           = useState('')
  const [fO2, setFO2]           = useState('')
  const [fGluc, setFGluc]       = useState('')
  const [fPeso, setFPeso]       = useState('')
  const [fTalla, setFTalla]     = useState('')
  const [fGlasgow, setFGlasgow] = useState('')
  const [fObs, setFObs]         = useState('')

  // Nota form fields
  const [fTipoNota, setFTipoNota]   = useState('EVOLUCION')
  const [fContenido, setFContenido] = useState('')
  const [fUrgente, setFUrgente]     = useState(false)

  const encSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pacSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ============================================================
  // Fetch encamamientos activos
  // ============================================================
  const fetchEncamamientos = useCallback(async () => {
    setEncLoading(true)
    try {
      const params: Record<string, string | number> = { estado: 'INGRESADO', page_size: 50, ordering: 'cama' }
      if (encSearch) params.search = encSearch
      const r = await api.get('/hospitalization/', { params })
      setEncTotal(r.data.count ?? 0)
      const freshList: Encamamiento[] = r.data.results ?? []
      setEncamamientos(freshList)
      // Sync selectedEnc with fresh data (fixes stale paciente field after serializer updates)
      setSelectedEnc(prev => {
        if (!prev) return prev
        return freshList.find(e => e.enc_id === prev.enc_id) ?? prev
      })
    } catch { /* ignore */ } finally {
      setEncLoading(false)
    }
  }, [encSearch])

  useEffect(() => { fetchEncamamientos() }, [encSearch]) // eslint-disable-line

  // ============================================================
  // Fetch signos / notas del paciente seleccionado
  // ============================================================
  const fetchSignosEnc = useCallback(async (pacId: number) => {
    setSignosLoad(true)
    try {
      const r = await api.get('/nursing/signos-vitales/', { params: { paciente: pacId, page_size: 10 } })
      setSignos(r.data.results ?? [])
    } catch { /* ignore */ } finally { setSignosLoad(false) }
  }, [])

  const fetchNotasEnc = useCallback(async (pacId: number) => {
    setNotasLoad(true)
    try {
      const r = await api.get('/nursing/notas/', { params: { paciente: pacId, page_size: 10 } })
      setNotas(r.data.results ?? [])
    } catch { /* ignore */ } finally { setNotasLoad(false) }
  }, [])

  useEffect(() => {
    if (selectedEnc) {
      fetchSignosEnc(selectedEnc.paciente)
      fetchNotasEnc(selectedEnc.paciente)
    }
  }, [selectedEnc]) // eslint-disable-line

  // ============================================================
  // Fetch global lists
  // ============================================================
  const fetchAllSignos = useCallback(async () => {
    setAllSignosLoad(true)
    try {
      const params: Record<string, string | number> = { page_size: 30 }
      if (selectedPac) params.paciente = selectedPac.pac_id
      const r = await api.get('/nursing/signos-vitales/', { params })
      setAllSignosTotal(r.data.count ?? 0); setAllSignos(r.data.results ?? [])
    } catch { /* ignore */ } finally { setAllSignosLoad(false) }
  }, [selectedPac])

  const fetchAllNotas = useCallback(async () => {
    setAllNotasLoad(true)
    try {
      const params: Record<string, string | number> = { page_size: 30 }
      if (selectedPac) params.paciente = selectedPac.pac_id
      const r = await api.get('/nursing/notas/', { params })
      setAllNotasTotal(r.data.count ?? 0); setAllNotas(r.data.results ?? [])
    } catch { /* ignore */ } finally { setAllNotasLoad(false) }
  }, [selectedPac])

  useEffect(() => {
    if (tab === 'signos') fetchAllSignos()
    if (tab === 'notas')  fetchAllNotas()
  }, [tab, selectedPac]) // eslint-disable-line

  // ============================================================
  // Patient search
  // ============================================================
  const searchPacientes = useCallback(async (q: string) => {
    if (!q.trim()) { setPacResults([]); return }
    setPacSearchLoad(true)
    try {
      const r = await api.get('/patients/', { params: { search: q, page_size: 8 } })
      setPacResults(r.data.results ?? [])
    } catch { /* ignore */ } finally { setPacSearchLoad(false) }
  }, [])

  // ============================================================
  // Handlers
  // ============================================================
  function handleEncSearch(val: string) {
    if (encSearchTimer.current) clearTimeout(encSearchTimer.current)
    encSearchTimer.current = setTimeout(() => setEncSearch(val), 400)
  }

  function handlePacSearch(val: string) {
    setPacSearch(val)
    if (pacSearchTimer.current) clearTimeout(pacSearchTimer.current)
    pacSearchTimer.current = setTimeout(() => searchPacientes(val), 400)
  }

  function openModal(mode: ModalMode) {
    setModalMode(mode); setModalErr('')
    setFTemp(''); setFSist(''); setFDias(''); setFFC(''); setFFR('')
    setFO2(''); setFGluc(''); setFPeso(''); setFTalla(''); setFGlasgow(''); setFObs('')
    setFTipoNota('EVOLUCION'); setFContenido(''); setFUrgente(false)
  }

  async function handleSubmitSigno() {
    const pacId = selectedEnc?.paciente
    if (!pacId) return
    setSaving(true); setModalErr('')
    try {
      const payload: Record<string, string | number | null> = {
        paciente: pacId,
        encamamiento: selectedEnc?.enc_id ?? null,
      }
      if (fTemp)    payload.temperatura             = fTemp
      if (fSist)    payload.presion_sistolica       = parseInt(fSist)
      if (fDias)    payload.presion_diastolica      = parseInt(fDias)
      if (fFC)      payload.frecuencia_cardiaca     = parseInt(fFC)
      if (fFR)      payload.frecuencia_respiratoria = parseInt(fFR)
      if (fO2)      payload.saturacion_o2           = fO2
      if (fGluc)    payload.glucemia                = fGluc
      if (fPeso)    payload.peso                    = fPeso
      if (fTalla)   payload.talla                   = fTalla
      if (fGlasgow) payload.glasgow                 = parseInt(fGlasgow)
      if (fObs)     payload.observaciones           = fObs
      await api.post('/nursing/signos-vitales/', payload)
      setModalMode(null)
      fetchSignosEnc(pacId)
    } catch (err: any) {
      const d = err?.response?.data
      if (typeof d === 'string') setModalErr(d)
      else if (d?.non_field_errors) setModalErr(d.non_field_errors[0])
      else setModalErr('Error al registrar signos vitales.')
    } finally { setSaving(false) }
  }

  async function handleSubmitNota() {
    const pacId = selectedEnc?.paciente
    if (!pacId) return
    if (fContenido.trim().length < 10) { setModalErr('La nota debe tener al menos 10 caracteres.'); return }
    setSaving(true); setModalErr('')
    try {
      await api.post('/nursing/notas/', {
        paciente: pacId,
        encamamiento: selectedEnc?.enc_id ?? null,
        tipo_nota: fTipoNota,
        contenido: fContenido,
        es_urgente: fUrgente,
      })
      setModalMode(null)
      fetchNotasEnc(pacId)
    } catch (err: any) {
      const d = err?.response?.data
      if (d?.contenido) setModalErr(d.contenido[0])
      else setModalErr('Error al guardar la nota.')
    } finally { setSaving(false) }
  }

  // ============================================================
  // Render helpers
  // ============================================================
  const SignoCard = ({ s }: { s: SignoVital }) => (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-gray-500">{fmtDate(s.created_at)} · {s.enfermera}</span>
      </div>
      <div className="flex flex-wrap gap-2 text-sm">
        {s.temperatura        && <span className="bg-red-50 text-red-700 px-2 py-1 rounded font-medium">🌡 {s.temperatura}°C</span>}
        {s.presion_arterial   && <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded font-medium">PA {s.presion_arterial}</span>}
        {s.frecuencia_cardiaca && <span className="bg-rose-50 text-rose-700 px-2 py-1 rounded font-medium">FC {s.frecuencia_cardiaca}</span>}
        {s.saturacion_o2      && <span className="bg-cyan-50 text-cyan-700 px-2 py-1 rounded font-medium">SpO₂ {s.saturacion_o2}%</span>}
        {s.frecuencia_respiratoria && <span className="bg-teal-50 text-teal-700 px-2 py-1 rounded font-medium">FR {s.frecuencia_respiratoria}</span>}
        {s.glucemia           && <span className="bg-amber-50 text-amber-700 px-2 py-1 rounded font-medium">Gluc {s.glucemia} mg/dL</span>}
        {s.glasgow            && <span className="bg-violet-50 text-violet-700 px-2 py-1 rounded font-medium">Glasgow {s.glasgow}/15</span>}
        {s.imc                && <span className="bg-gray-50 text-gray-700 px-2 py-1 rounded font-medium">IMC {s.imc}</span>}
      </div>
      {s.observaciones && <p className="mt-2 text-xs text-gray-500 italic">{s.observaciones}</p>}
    </div>
  )

  const NotaCard = ({ n }: { n: NotaEnfermeria }) => (
    <div className={`bg-white rounded-lg border p-4 ${n.es_urgente ? 'border-red-300' : 'border-gray-200'}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${TIPO_NOTA_STYLE[n.tipo_nota]}`}>
            {n.tipo_nota_display}
          </span>
          {n.es_urgente && (
            <span className="px-2 py-0.5 text-xs font-bold bg-red-600 text-white rounded-full">URGENTE</span>
          )}
        </div>
        <span className="text-xs text-gray-400 flex-shrink-0">{fmtDate(n.created_at)}</span>
      </div>
      <p className="text-sm text-gray-800 whitespace-pre-wrap">{n.contenido}</p>
      <p className="mt-2 text-xs text-gray-500">— {n.enfermera}</p>
    </div>
  )

  // Patient search dropdown (shared between signos/notas global tabs)
  const PacSearchBox = () => (
    <div className="relative">
      <input
        type="text"
        placeholder="Filtrar por paciente..."
        value={pacSearch}
        onChange={e => handlePacSearch(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {pacSearchLoad && <span className="absolute right-3 top-2 text-xs text-gray-400">Buscando...</span>}
      {selectedPac && !pacSearchLoad && (
        <button onClick={() => { setSelectedPac(null); setPacSearch('') }}
          className="absolute right-3 top-2 text-gray-400 hover:text-gray-600 text-sm">✕</button>
      )}
      {pacResults.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-10 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
          {pacResults.map(p => (
            <button key={p.pac_id}
              onClick={() => { setSelectedPac(p); setPacSearch(`${p.primer_nombre} ${p.primer_apellido}`); setPacResults([]) }}
              className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm">
              <span className="font-medium">{p.primer_nombre} {p.primer_apellido}</span>
              <span className="text-gray-400 ml-2">{p.no_expediente}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )

  // ============================================================
  // JSX
  // ============================================================
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Estación de Enfermería</h1>
          <p className="text-sm text-gray-500">Signos vitales y notas clínicas</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-gray-200">
        {([
          { key: 'pacientes', label: '🛏️ Pacientes Encamados' },
          { key: 'signos',    label: '💓 Signos Vitales' },
          { key: 'notas',     label: '📝 Notas' },
        ] as { key: Tab; label: string }[]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ======================================================
          TAB: PACIENTES ENCAMADOS
      ====================================================== */}
      {tab === 'pacientes' && (
        <div className="flex flex-1 gap-4 min-h-0 overflow-hidden">
          {/* Left: list */}
          <div className="w-72 flex flex-col gap-3 flex-shrink-0">
            <input type="text" placeholder="Buscar paciente, cama..."
              onChange={e => handleEncSearch(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <p className="text-xs text-gray-500">{encTotal} paciente{encTotal !== 1 ? 's' : ''} encamado{encTotal !== 1 ? 's' : ''}</p>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {encamamientos.map(enc => (
                <div key={enc.enc_id} onClick={() => { setSelectedEnc(enc); setRightTab('signos') }}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    selectedEnc?.enc_id === enc.enc_id
                      ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-blue-300'
                  }`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {enc.paciente_nombre || `Paciente #${enc.paciente}`}
                      </p>
                      <p className="text-xs text-gray-500">{enc.paciente_expediente || '—'}</p>
                    </div>
                    <span className="flex-shrink-0 px-2 py-0.5 text-xs font-bold bg-indigo-100 text-indigo-800 rounded-full">
                      {enc.cama_info?.numero || '—'}
                    </span>
                  </div>
                  {enc.cama_info?.sala && <p className="mt-0.5 text-xs text-gray-400">{enc.cama_info.sala}</p>}
                  {enc.motivo_ingreso && (
                    <p className="mt-1 text-xs text-gray-600 truncate">{enc.motivo_ingreso}</p>
                  )}
                </div>
              ))}
              {encLoading && <p className="text-center py-4 text-sm text-gray-400">Cargando...</p>}
              {!encLoading && encamamientos.length === 0 && (
                <p className="text-center py-8 text-sm text-gray-400">Sin pacientes encamados</p>
              )}
            </div>
          </div>

          {/* Right: detail */}
          <div className="flex-1 overflow-y-auto">
            {!selectedEnc ? (
              <div className="h-full flex items-center justify-center text-gray-400">
                <div className="text-center"><p className="text-4xl mb-2">🛏️</p><p>Selecciona un paciente</p></div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Header */}
                <div className="bg-white rounded-lg border border-gray-200 p-4 flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">
                      {selectedEnc.paciente_nombre || `Paciente #${selectedEnc.paciente}`}
                    </h2>
                    <p className="text-sm text-gray-500">
                      Exp. {selectedEnc.paciente_expediente || '—'} · Cama {selectedEnc.cama_info?.numero || '—'}
                      {selectedEnc.cama_info?.sala ? ` · ${selectedEnc.cama_info.sala}` : ''}
                    </p>
                    {selectedEnc.motivo_ingreso && (
                      <p className="mt-1 text-sm text-gray-600">{selectedEnc.motivo_ingreso}</p>
                    )}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => openModal('signo')}
                      className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-sm font-medium hover:bg-rose-700">
                      💓 Signos
                    </button>
                    <button onClick={() => openModal('nota')}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                      📝 Nota
                    </button>
                  </div>
                </div>

                {/* Sub-tabs */}
                <div className="flex gap-1 border-b border-gray-200">
                  {(['signos', 'notas'] as RightTab[]).map(rt => (
                    <button key={rt} onClick={() => setRightTab(rt)}
                      className={`px-3 py-1.5 text-sm font-medium border-b-2 transition-colors ${
                        rightTab === rt ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}>
                      {rt === 'signos' ? '💓 Signos Vitales' : '📝 Notas de Enfermería'}
                    </button>
                  ))}
                </div>

                {rightTab === 'signos' && (
                  <div className="space-y-3">
                    {signosLoad ? <p className="text-center py-4 text-sm text-gray-400">Cargando...</p>
                      : signos.length === 0 ? <p className="text-center py-8 text-sm text-gray-400">Sin signos registrados</p>
                      : signos.map(s => <SignoCard key={s.sig_id} s={s} />)}
                  </div>
                )}

                {rightTab === 'notas' && (
                  <div className="space-y-3">
                    {notasLoad ? <p className="text-center py-4 text-sm text-gray-400">Cargando...</p>
                      : notas.length === 0 ? <p className="text-center py-8 text-sm text-gray-400">Sin notas registradas</p>
                      : notas.map(n => <NotaCard key={n.nota_id} n={n} />)}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================
          TAB: SIGNOS VITALES (global)
      ====================================================== */}
      {tab === 'signos' && (
        <div className="flex-1 flex flex-col gap-3 min-h-0">
          <PacSearchBox />
          <p className="text-xs text-gray-500">{allSignosTotal} registro{allSignosTotal !== 1 ? 's' : ''}</p>
          <div className="flex-1 overflow-auto space-y-3">
            {allSignos.map(s => <SignoCard key={s.sig_id} s={s} />)}
            {allSignosLoad && <p className="text-center py-4 text-sm text-gray-400">Cargando...</p>}
            {!allSignosLoad && allSignos.length === 0 && <p className="text-center py-8 text-sm text-gray-400">Sin registros</p>}
          </div>
        </div>
      )}

      {/* ======================================================
          TAB: NOTAS (global)
      ====================================================== */}
      {tab === 'notas' && (
        <div className="flex-1 flex flex-col gap-3 min-h-0">
          <PacSearchBox />
          <p className="text-xs text-gray-500">{allNotasTotal} nota{allNotasTotal !== 1 ? 's' : ''}</p>
          <div className="flex-1 overflow-auto space-y-3">
            {allNotas.map(n => <NotaCard key={n.nota_id} n={n} />)}
            {allNotasLoad && <p className="text-center py-4 text-sm text-gray-400">Cargando...</p>}
            {!allNotasLoad && allNotas.length === 0 && <p className="text-center py-8 text-sm text-gray-400">Sin notas</p>}
          </div>
        </div>
      )}

      {/* ======================================================
          MODAL
      ====================================================== */}
      {modalMode && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {modalMode === 'signo' ? '💓 Tomar Signos Vitales' : '📝 Nueva Nota de Enfermería'}
                </h2>
                {selectedEnc && (
                  <p className="text-sm text-gray-500">
                    {selectedEnc.paciente_nombre || `Pac #${selectedEnc.paciente}`} · Cama {selectedEnc.cama_info?.numero || '—'}
                  </p>
                )}
              </div>
              <button onClick={() => setModalMode(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>

            <div className="px-6 py-4 overflow-y-auto flex-1 space-y-4">
              {modalErr && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{modalErr}</div>
              )}

              {modalMode === 'signo' && (
                <>
                  <p className="text-xs text-gray-500">Complete los campos disponibles. Al menos un valor es requerido.</p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Temperatura (°C)', val: fTemp, set: setFTemp, step: '0.1', min: '25', max: '45', ph: '36.5' },
                      { label: 'FC (bpm)',          val: fFC,   set: setFFC,   step: '1',   min: '0',  max: '300', ph: '72' },
                      { label: 'PA Sistólica',      val: fSist, set: setFSist, step: '1',   min: '0',  max: '300', ph: '120' },
                      { label: 'PA Diastólica',     val: fDias, set: setFDias, step: '1',   min: '0',  max: '200', ph: '80' },
                      { label: 'FR (rpm)',           val: fFR,   set: setFFR,   step: '1',   min: '0',  max: '60',  ph: '16' },
                      { label: 'SpO₂ (%)',          val: fO2,   set: setFO2,   step: '0.1', min: '0',  max: '100', ph: '98.5' },
                      { label: 'Glucemia (mg/dL)',  val: fGluc, set: setFGluc, step: '0.1', min: '0',  max: '999', ph: '90' },
                      { label: 'Glasgow (3-15)',    val: fGlasgow, set: setFGlasgow, step: '1', min: '3', max: '15', ph: '15' },
                      { label: 'Peso (kg)',          val: fPeso,  set: setFPeso,  step: '0.1', min: '0', max: '300', ph: '70' },
                      { label: 'Talla (cm)',         val: fTalla, set: setFTalla, step: '0.1', min: '0', max: '250', ph: '170' },
                    ].map(f => (
                      <div key={f.label}>
                        <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}</label>
                        <input type="number" step={f.step} min={f.min} max={f.max}
                          value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.ph}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                    ))}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Observaciones</label>
                    <input type="text" value={fObs} onChange={e => setFObs(e.target.value)}
                      placeholder="Observaciones adicionales..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </>
              )}

              {modalMode === 'nota' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de nota</label>
                    <select value={fTipoNota} onChange={e => setFTipoNota(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none">
                      {TIPO_NOTA_CHOICES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Contenido *</label>
                    <textarea value={fContenido} onChange={e => setFContenido(e.target.value)} rows={5}
                      placeholder="Describa la evolución, procedimiento o novedad..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                    <p className="text-xs text-gray-400 mt-1">{fContenido.length} caracteres (mín. 10)</p>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={fUrgente} onChange={e => setFUrgente(e.target.checked)}
                      className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500" />
                    <span className="text-sm font-medium text-gray-700">Marcar como urgente</span>
                  </label>
                </>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3 flex-shrink-0">
              <button onClick={() => setModalMode(null)}
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={modalMode === 'signo' ? handleSubmitSigno : handleSubmitNota}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
