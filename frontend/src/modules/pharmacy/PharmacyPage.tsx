import { useState, useEffect, useCallback, useRef } from 'react'
import api from '../../services/api'

// ============================================================
// Types
// ============================================================
interface Medicamento {
  med_id: number
  nombre_generico: string
  nombre_comercial: string
  concentracion: string
  forma_farma: string
  forma_farma_display: string
  categoria: string
  categoria_display: string
  unidad_medida: string
  stock_actual: number
  stock_minimo: number
  precio_unitario: string
  requiere_receta: boolean
  stock_bajo: boolean
  principio_activo?: string
  activo: boolean
}

interface Dispensacion {
  dis_id: number
  estado: string
  estado_display: string
  paciente_nombre: string
  paciente_expediente: string
  medicamento_nombre: string
  medicamento_concentracion: string
  medicamento_forma: string
  medicamento_categoria?: string
  medicamento_unidad?: string
  cantidad: string
  dosis?: string
  frecuencia?: string
  duracion_dias?: number
  via_admin: string
  via_admin_display: string
  indicaciones?: string
  medico_nombre?: string
  dispensado_por_nombre?: string
  fecha_prescripcion: string
  fecha_dispensacion?: string
  hora_dispensacion_fmt?: string
  notas_farmacia?: string
  motivo_cancelacion?: string
}

interface Patient { pac_id: number; primer_nombre: string; primer_apellido: string; no_expediente: string }
interface Usuario { usr_id: number; primer_nombre: string; primer_apellido: string }

// ============================================================
// Helpers
// ============================================================
const ESTADO_DIS: Record<string, string> = {
  PENDIENTE:  'bg-yellow-100 text-yellow-800',
  DISPENSADA: 'bg-green-100 text-green-800',
  CANCELADA:  'bg-gray-100 text-gray-600',
}

const FORMA_ICON: Record<string, string> = {
  TABLETA: '💊', CAPSULA: '💊', JARABE: '🧴', INYECTABLE: '💉',
  CREMA: '🧴', SOLUCION: '💧', GOTAS: '💧', OTRO: '🔬',
}

// ============================================================
// Main Component
// ============================================================
export default function PharmacyPage() {
  const [activeTab, setActiveTab] = useState<'dispensaciones' | 'catalogo'>('dispensaciones')

  // ── Dispensaciones state ──────────────────────────────────
  const [dispensaciones, setDispensaciones]   = useState<Dispensacion[]>([])
  const [selectedDis, setSelectedDis]         = useState<Dispensacion | null>(null)
  const [disSearch, setDisSearch]             = useState('')
  const [disEstado, setDisEstado]             = useState('')
  const [disLoading, setDisLoading]           = useState(false)
  const [disPage, setDisPage]                 = useState(1)
  const [disHasMore, setDisHasMore]           = useState(false)
  const [disTotalCount, setDisTotalCount]     = useState(0)
  const disSearchTimer                        = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Catálogo state ────────────────────────────────────────
  const [medicamentos, setMedicamentos]       = useState<Medicamento[]>([])
  const [medSearch, setMedSearch]             = useState('')
  const [medCategoria, setMedCategoria]       = useState('')
  const [medLoading, setMedLoading]           = useState(false)
  const [medTotalCount, setMedTotalCount]     = useState(0)

  // ── Modal state ───────────────────────────────────────────
  const [showModalNuevaDis, setShowModalNuevaDis]         = useState(false)
  const [showModalDispensar, setShowModalDispensar]       = useState(false)
  const [showModalCancelarDis, setShowModalCancelarDis]   = useState(false)
  const [showModalNuevoMed, setShowModalNuevoMed]         = useState(false)
  const [showModalReponer, setShowModalReponer]           = useState(false)
  const [editMed, setEditMed]                             = useState<Medicamento | null>(null)
  const [actionLoading, setActionLoading]                 = useState(false)
  const [actionError, setActionError]                     = useState('')

  // ── Patient/Med search ────────────────────────────────────
  const [patSearch, setPatSearch]     = useState('')
  const [patResults, setPatResults]   = useState<Patient[]>([])
  const [patSelected, setPatSelected] = useState<Patient | null>(null)
  const [medSelected, setMedSelected] = useState<Medicamento | null>(null)
  const patSearchTimer                = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Users list ────────────────────────────────────────────
  const [usuarios, setUsuarios]       = useState<Usuario[]>([])

  // ── Forms ─────────────────────────────────────────────────
  const [disForm, setDisForm] = useState({
    medico_prescribe: '', cantidad: '', dosis: '', frecuencia: '',
    duracion_dias: '', via_admin: 'ORAL', indicaciones: '',
    fecha_prescripcion: new Date().toISOString().slice(0, 10),
  })
  const [dispensarForm, setDispensarForm]     = useState({ notas_farmacia: '' })
  const [cancelarDisForm, setCancelarDisForm] = useState({ motivo_cancelacion: '' })
  const [medForm, setMedForm] = useState({
    nombre_generico: '', nombre_comercial: '', principio_activo: '',
    concentracion: '', forma_farma: 'TABLETA', categoria: 'OTRO',
    unidad_medida: 'tableta', stock_actual: '0', stock_minimo: '10',
    precio_unitario: '0.00', requiere_receta: false,
  })
  const [reponerForm, setReponerForm] = useState({ cantidad: '', notas: '' })

  // ── Load data ─────────────────────────────────────────────
  const loadDispensaciones = useCallback(async (page = 1, reset = true) => {
    setDisLoading(true)
    try {
      const params: Record<string, string | number> = { page, page_size: 20 }
      if (disSearch) params.search = disSearch
      if (disEstado) params.estado = disEstado
      const r = await api.get('/pharmacy/dispensaciones/', { params })
      const results: Dispensacion[] = r.data.results ?? r.data
      setDispensaciones(prev => reset ? results : [...prev, ...results])
      setDisHasMore(!!r.data.next)
      setDisTotalCount(r.data.count ?? results.length)
      setDisPage(page)
    } catch { /* silencioso */ } finally {
      setDisLoading(false)
    }
  }, [disSearch, disEstado])

  const loadMedicamentos = useCallback(async () => {
    setMedLoading(true)
    try {
      const params: Record<string, string | number> = { page_size: 100 }
      if (medSearch)    params.search   = medSearch
      if (medCategoria) params.categoria = medCategoria
      const r = await api.get('/pharmacy/medicamentos/', { params })
      const results: Medicamento[] = r.data.results ?? r.data
      setMedicamentos(results)
      setMedTotalCount(r.data.count ?? results.length)
    } catch { /* silencioso */ } finally {
      setMedLoading(false)
    }
  }, [medSearch, medCategoria])

  const loadUsuarios = useCallback(async () => {
    try {
      const r = await api.get('/auth/usuarios/', { params: { page_size: 100 } })
      setUsuarios(r.data.results ?? r.data)
    } catch { /* silencioso */ }
  }, [])

  // ── Debounced search ──────────────────────────────────────
  useEffect(() => {
    if (disSearchTimer.current) clearTimeout(disSearchTimer.current)
    disSearchTimer.current = setTimeout(() => loadDispensaciones(1, true), 400)
    return () => { if (disSearchTimer.current) clearTimeout(disSearchTimer.current) }
  }, [disSearch, disEstado, loadDispensaciones])

  useEffect(() => { loadMedicamentos() }, [loadMedicamentos])
  useEffect(() => { loadUsuarios() }, [loadUsuarios])

  // ── Refresh detail ────────────────────────────────────────
  const refreshDetail = async (dis_id: number) => {
    const r = await api.get(`/pharmacy/dispensaciones/${dis_id}/`)
    setSelectedDis(r.data)
    setDispensaciones(prev => prev.map(d => d.dis_id === dis_id ? { ...d, ...r.data } : d))
  }

  // ── Patient search (modal) ────────────────────────────────
  const handlePatSearch = (q: string) => {
    setPatSearch(q)
    if (patSearchTimer.current) clearTimeout(patSearchTimer.current)
    if (q.length < 2) { setPatResults([]); return }
    patSearchTimer.current = setTimeout(async () => {
      const r = await api.get('/patients/', { params: { search: q, page_size: 10 } })
      setPatResults(r.data.results ?? r.data)
    }, 400)
  }

  // ── Actions ───────────────────────────────────────────────
  const handleNuevaDis = async () => {
    if (!patSelected || !medSelected) { setActionError('Seleccione paciente y medicamento.'); return }
    if (!disForm.cantidad) { setActionError('Ingrese la cantidad.'); return }
    setActionLoading(true); setActionError('')
    try {
      await api.post('/pharmacy/dispensaciones/', {
        medicamento: medSelected.med_id,
        paciente: patSelected.pac_id,
        medico_prescribe: disForm.medico_prescribe ? Number(disForm.medico_prescribe) : undefined,
        cantidad: Number(disForm.cantidad),
        dosis: disForm.dosis,
        frecuencia: disForm.frecuencia,
        duracion_dias: disForm.duracion_dias ? Number(disForm.duracion_dias) : undefined,
        via_admin: disForm.via_admin,
        indicaciones: disForm.indicaciones,
        fecha_prescripcion: disForm.fecha_prescripcion,
      })
      setShowModalNuevaDis(false)
      resetDisForm()
      await loadDispensaciones(1, true)
    } catch (e: any) {
      const msg = e.response?.data?.detail ?? e.response?.data ?? e.message ?? 'Error al crear dispensación'
      setActionError(typeof msg === 'string' ? msg : JSON.stringify(msg))
    } finally { setActionLoading(false) }
  }

  const handleDispensar = async () => {
    if (!selectedDis) return
    setActionLoading(true); setActionError('')
    try {
      await api.post(`/pharmacy/dispensaciones/${selectedDis.dis_id}/dispensar/`,
        { notas_farmacia: dispensarForm.notas_farmacia })
      setShowModalDispensar(false)
      await refreshDetail(selectedDis.dis_id)
      await loadMedicamentos()
    } catch (e: any) {
      const msg = e.response?.data?.detail ?? e.message ?? 'Error al dispensar'
      setActionError(typeof msg === 'string' ? msg : JSON.stringify(msg))
    } finally { setActionLoading(false) }
  }

  const handleCancelarDis = async () => {
    if (!selectedDis) return
    setActionLoading(true); setActionError('')
    try {
      await api.post(`/pharmacy/dispensaciones/${selectedDis.dis_id}/cancelar/`,
        { motivo_cancelacion: cancelarDisForm.motivo_cancelacion })
      setShowModalCancelarDis(false)
      await refreshDetail(selectedDis.dis_id)
    } catch (e: any) {
      const msg = e.response?.data?.detail ?? e.message ?? 'Error al cancelar'
      setActionError(typeof msg === 'string' ? msg : JSON.stringify(msg))
    } finally { setActionLoading(false) }
  }

  const handleGuardarMed = async () => {
    if (!medForm.nombre_generico) { setActionError('El nombre genérico es obligatorio.'); return }
    setActionLoading(true); setActionError('')
    try {
      const payload = {
        ...medForm,
        stock_actual: Number(medForm.stock_actual),
        stock_minimo: Number(medForm.stock_minimo),
      }
      if (editMed) {
        await api.put(`/pharmacy/medicamentos/${editMed.med_id}/`, payload)
      } else {
        await api.post('/pharmacy/medicamentos/', payload)
      }
      setShowModalNuevoMed(false)
      setEditMed(null)
      resetMedForm()
      await loadMedicamentos()
    } catch (e: any) {
      const msg = e.response?.data?.detail ?? e.response?.data ?? e.message ?? 'Error al guardar'
      setActionError(typeof msg === 'string' ? msg : JSON.stringify(msg))
    } finally { setActionLoading(false) }
  }

  const handleReponer = async () => {
    if (!editMed || !reponerForm.cantidad) return
    setActionLoading(true); setActionError('')
    try {
      await api.post(`/pharmacy/medicamentos/${editMed.med_id}/reponer/`,
        { cantidad: Number(reponerForm.cantidad), notas: reponerForm.notas })
      setShowModalReponer(false)
      setEditMed(null)
      setReponerForm({ cantidad: '', notas: '' })
      await loadMedicamentos()
    } catch (e: any) {
      const msg = e.response?.data?.detail ?? e.message ?? 'Error al reponer stock'
      setActionError(typeof msg === 'string' ? msg : JSON.stringify(msg))
    } finally { setActionLoading(false) }
  }

  const resetDisForm = () => {
    setDisForm({ medico_prescribe: '', cantidad: '', dosis: '', frecuencia: '',
      duracion_dias: '', via_admin: 'ORAL', indicaciones: '',
      fecha_prescripcion: new Date().toISOString().slice(0, 10) })
    setPatSelected(null); setMedSelected(null); setPatSearch(''); setPatResults([])
  }

  const resetMedForm = () => {
    setMedForm({ nombre_generico: '', nombre_comercial: '', principio_activo: '',
      concentracion: '', forma_farma: 'TABLETA', categoria: 'OTRO',
      unidad_medida: 'tableta', stock_actual: '0', stock_minimo: '10',
      precio_unitario: '0.00', requiere_receta: false })
  }

  const openEditMed = (med: Medicamento) => {
    setEditMed(med)
    setMedForm({
      nombre_generico: med.nombre_generico, nombre_comercial: med.nombre_comercial,
      principio_activo: med.principio_activo ?? '', concentracion: med.concentracion,
      forma_farma: med.forma_farma, categoria: med.categoria, unidad_medida: med.unidad_medida,
      stock_actual: String(med.stock_actual), stock_minimo: String(med.stock_minimo),
      precio_unitario: med.precio_unitario, requiere_receta: med.requiere_receta,
    })
    setShowModalNuevoMed(true)
  }

  // ============================================================
  // Render
  // ============================================================
  return (
    <div className="flex flex-col h-full">
      {/* ── Tabs ── */}
      <div className="border-b border-gray-200 bg-white px-6">
        <nav className="flex gap-6">
          {(['dispensaciones', 'catalogo'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              {tab === 'dispensaciones' ? '💊 Dispensaciones' : '📋 Catálogo de Medicamentos'}
            </button>
          ))}
        </nav>
      </div>

      {/* ══════════════════════════════════════════════════════
          TAB 1: DISPENSACIONES
      ══════════════════════════════════════════════════════ */}
      {activeTab === 'dispensaciones' && (
        <div className="flex flex-1 overflow-hidden">
          {/* Lista izquierda */}
          <div className="w-96 flex flex-col border-r border-gray-200 bg-white">
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h1 className="text-lg font-bold text-gray-900">Farmacia</h1>
                  <p className="text-xs text-gray-400">
                    Módulo M08 — {disTotalCount} {disTotalCount === 1 ? 'dispensación' : 'dispensaciones'}
                  </p>
                </div>
                <button onClick={() => { setActionError(''); resetDisForm(); setShowModalNuevaDis(true) }}
                  className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700">
                  <span>+</span> Nueva
                </button>
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">🔍</span>
                  <input value={disSearch} onChange={e => setDisSearch(e.target.value)}
                    placeholder="Paciente, medicamento..."
                    className="w-full pl-6 pr-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400" />
                </div>
                <select value={disEstado} onChange={e => setDisEstado(e.target.value)}
                  className="text-xs border border-gray-200 rounded-md px-2 focus:outline-none">
                  <option value="">Todos</option>
                  <option value="PENDIENTE">Pendiente</option>
                  <option value="DISPENSADA">Dispensada</option>
                  <option value="CANCELADA">Cancelada</option>
                </select>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {disLoading && dispensaciones.length === 0 && (
                <div className="p-4 text-center text-xs text-gray-400">Cargando…</div>
              )}
              {!disLoading && dispensaciones.length === 0 && (
                <div className="p-8 text-center">
                  <p className="text-2xl mb-2">💊</p>
                  <p className="text-sm text-gray-500">Sin dispensaciones</p>
                </div>
              )}
              <div className="divide-y divide-gray-100">
                {dispensaciones.map(d => (
                  <button key={d.dis_id} onClick={() => setSelectedDis(d)}
                    className={`w-full text-left p-3 hover:bg-gray-50 transition-colors ${
                      selectedDis?.dis_id === d.dis_id ? 'bg-blue-50 border-l-2 border-blue-500' : ''
                    }`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-gray-800 truncate max-w-[150px]">
                        {d.paciente_nombre}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${ESTADO_DIS[d.estado] ?? 'bg-gray-100 text-gray-600'}`}>
                        {d.estado_display}
                      </span>
                    </div>
                    <p className="text-xs text-blue-700 font-medium truncate">
                      {FORMA_ICON[d.medicamento_forma?.toUpperCase() ?? ''] ?? '💊'} {d.medicamento_nombre} {d.medicamento_concentracion}
                    </p>
                    <div className="flex gap-2 mt-1 text-[10px] text-gray-400">
                      <span>📅 {d.fecha_prescripcion}</span>
                      <span>· {d.cantidad} · {d.via_admin_display}</span>
                    </div>
                  </button>
                ))}
              </div>
              {disHasMore && (
                <div className="p-3 text-center">
                  <button onClick={() => loadDispensaciones(disPage + 1, false)}
                    className="text-xs text-blue-600 hover:underline">Cargar más…</button>
                </div>
              )}
            </div>
          </div>

          {/* Panel derecho: detalle */}
          <div className="flex-1 overflow-y-auto bg-gray-50">
            {!selectedDis ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <p className="text-4xl mb-3">💊</p>
                <p className="text-sm font-medium">Seleccione una dispensación</p>
                <p className="text-xs mt-1">Ver detalle y gestionar</p>
              </div>
            ) : (
              <div className="p-6 max-w-3xl mx-auto">
                {/* Header */}
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{selectedDis.paciente_nombre}</h2>
                    <p className="text-sm text-gray-500">Exp. {selectedDis.paciente_expediente} · DIS-{selectedDis.dis_id}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`text-xs px-3 py-1 rounded-full font-semibold ${ESTADO_DIS[selectedDis.estado] ?? ''}`}>
                      {selectedDis.estado_display}
                    </span>
                    {selectedDis.estado === 'PENDIENTE' && (
                      <div className="flex gap-2 mt-1">
                        <button onClick={() => { setDispensarForm({ notas_farmacia: '' }); setActionError(''); setShowModalDispensar(true) }}
                          className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700">
                          ✓ Dispensar
                        </button>
                        <button onClick={() => { setCancelarDisForm({ motivo_cancelacion: '' }); setActionError(''); setShowModalCancelarDis(true) }}
                          className="px-3 py-1.5 text-xs bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100">
                          Cancelar
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Medicamento */}
                <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">💊 Medicamento</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-xs text-gray-400">Nombre genérico</dt>
                      <dd className="font-medium text-gray-800">{selectedDis.medicamento_nombre} {selectedDis.medicamento_concentracion}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-gray-400">Forma / Categoría</dt>
                      <dd className="text-gray-700">{selectedDis.medicamento_forma} · {selectedDis.medicamento_categoria}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-gray-400">Cantidad prescrita</dt>
                      <dd className="font-semibold text-gray-800">{selectedDis.cantidad} {selectedDis.medicamento_unidad}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-gray-400">Vía de administración</dt>
                      <dd className="text-gray-700">{selectedDis.via_admin_display}</dd>
                    </div>
                  </div>
                </div>

                {/* Prescripción */}
                <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">📋 Prescripción</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-xs text-gray-400">Médico prescriptor</dt>
                      <dd className="text-gray-700">{selectedDis.medico_nombre || 'No especificado'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-gray-400">Fecha prescripción</dt>
                      <dd className="text-gray-700">{selectedDis.fecha_prescripcion}</dd>
                    </div>
                    {selectedDis.dosis && (
                      <div>
                        <dt className="text-xs text-gray-400">Dosis</dt>
                        <dd className="text-gray-700">{selectedDis.dosis}</dd>
                      </div>
                    )}
                    {selectedDis.frecuencia && (
                      <div>
                        <dt className="text-xs text-gray-400">Frecuencia</dt>
                        <dd className="text-gray-700">{selectedDis.frecuencia}</dd>
                      </div>
                    )}
                    {selectedDis.duracion_dias && (
                      <div>
                        <dt className="text-xs text-gray-400">Duración</dt>
                        <dd className="text-gray-700">{selectedDis.duracion_dias} días</dd>
                      </div>
                    )}
                    {selectedDis.indicaciones && (
                      <div className="col-span-2">
                        <dt className="text-xs text-gray-400">Indicaciones</dt>
                        <dd className="text-gray-700">{selectedDis.indicaciones}</dd>
                      </div>
                    )}
                  </div>
                </div>

                {/* Dispensación completada */}
                {selectedDis.estado === 'DISPENSADA' && (
                  <div className="bg-green-50 rounded-xl border border-green-200 p-4 mb-4">
                    <h3 className="text-sm font-semibold text-green-700 mb-3">✅ Dispensado</h3>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <dt className="text-xs text-green-600">Dispensado por</dt>
                        <dd className="text-gray-800 font-medium">{selectedDis.dispensado_por_nombre}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-green-600">Fecha y hora</dt>
                        <dd className="text-gray-800">
                          {selectedDis.fecha_dispensacion}
                          {selectedDis.hora_dispensacion_fmt && ` a las ${selectedDis.hora_dispensacion_fmt}`}
                        </dd>
                      </div>
                      {selectedDis.notas_farmacia && (
                        <div className="col-span-2">
                          <dt className="text-xs text-green-600">Notas farmacia</dt>
                          <dd className="text-gray-700">{selectedDis.notas_farmacia}</dd>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Cancelación */}
                {selectedDis.estado === 'CANCELADA' && (
                  <div className="bg-red-50 rounded-xl border border-red-200 p-4 mb-4">
                    <h3 className="text-sm font-semibold text-red-700 mb-2">❌ Cancelada</h3>
                    <p className="text-sm text-gray-700">{selectedDis.motivo_cancelacion}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          TAB 2: CATÁLOGO DE MEDICAMENTOS
      ══════════════════════════════════════════════════════ */}
      {activeTab === 'catalogo' && (
        <div className="flex flex-col flex-1 overflow-hidden bg-white">
          <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200">
            <div className="flex gap-3 items-center">
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">🔍</span>
                <input value={medSearch} onChange={e => setMedSearch(e.target.value)}
                  placeholder="Nombre, principio activo…"
                  className="pl-6 pr-3 py-1.5 text-xs border border-gray-200 rounded-md w-52 focus:outline-none focus:ring-1 focus:ring-blue-400" />
              </div>
              <select value={medCategoria} onChange={e => setMedCategoria(e.target.value)}
                className="text-xs border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none">
                <option value="">Todas las categorías</option>
                {['ANALGESICO','ANTIBIOTICO','ANTIHIPERTENSIVO','ANTIDIABETICO','VITAMINA',
                  'ANTIINFLAMATORIO','CARDIOVASCULAR','NEUROLOGICO','RESPIRATORIO','OTRO'].map(c => (
                  <option key={c} value={c}>{c.charAt(0)+c.slice(1).toLowerCase().replace('_',' ')}</option>
                ))}
              </select>
              <p className="text-xs text-gray-400">{medTotalCount} medicamento{medTotalCount !== 1 ? 's' : ''}</p>
            </div>
            <button onClick={() => { setEditMed(null); resetMedForm(); setActionError(''); setShowModalNuevoMed(true) }}
              className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700">
              <span>+</span> Nuevo Medicamento
            </button>
          </div>

          <div className="flex-1 overflow-auto">
            {medLoading ? (
              <div className="p-8 text-center text-xs text-gray-400">Cargando catálogo…</div>
            ) : medicamentos.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-2xl mb-2">📋</p>
                <p className="text-sm text-gray-500">Sin medicamentos en el catálogo</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    {['Medicamento','Forma / Categoría','Stock','Mín.','Precio','Receta','Acciones'].map(h => (
                      <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {medicamentos.map(med => (
                    <tr key={med.med_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800">{med.nombre_generico} {med.concentracion}</p>
                        {med.nombre_comercial && <p className="text-xs text-gray-400">{med.nombre_comercial}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full mr-1">
                          {FORMA_ICON[med.forma_farma] ?? '💊'} {med.forma_farma_display}
                        </span>
                        <span className="text-xs text-gray-500">{med.categoria_display}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${med.stock_bajo ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                          {med.stock_actual} {med.unidad_medida}
                        </span>
                        {med.stock_bajo && <p className="text-[10px] text-red-600 mt-0.5">⚠ Stock bajo</p>}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{med.stock_minimo}</td>
                      <td className="px-4 py-3 text-xs text-gray-700">Q{med.precio_unitario}</td>
                      <td className="px-4 py-3 text-center">
                        {med.requiere_receta
                          ? <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">Sí</span>
                          : <span className="text-[10px] text-gray-400">No</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button onClick={() => openEditMed(med)}
                            className="text-xs px-2 py-1 text-blue-600 hover:bg-blue-50 rounded">Editar</button>
                          <button onClick={() => { setEditMed(med); setReponerForm({ cantidad: '', notas: '' }); setActionError(''); setShowModalReponer(true) }}
                            className="text-xs px-2 py-1 text-green-700 hover:bg-green-50 rounded">+Stock</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          MODALES
      ══════════════════════════════════════════════════════ */}

      {/* Modal: Nueva Dispensación */}
      {showModalNuevaDis && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900">💊 Nueva Dispensación</h2>
            </div>
            <div className="p-5 space-y-4">
              {/* Paciente */}
              <fieldset className="border border-gray-200 rounded-lg p-3">
                <legend className="text-xs font-semibold text-gray-600 px-1">Paciente</legend>
                <div className="relative">
                  <input value={patSearch} onChange={e => handlePatSearch(e.target.value)}
                    placeholder="Buscar por nombre o expediente…"
                    className="w-full text-xs border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                  {patResults.length > 0 && (
                    <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-md mt-1 shadow-lg">
                      {patResults.map(p => (
                        <button key={p.pac_id} onClick={() => { setPatSelected(p); setPatSearch(`${p.primer_nombre} ${p.primer_apellido}`); setPatResults([]) }}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50">
                          {p.primer_nombre} {p.primer_apellido} — Exp. {p.no_expediente}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {patSelected && <p className="text-xs text-green-700 mt-1">✓ {patSelected.primer_nombre} {patSelected.primer_apellido} (Exp. {patSelected.no_expediente})</p>}
              </fieldset>

              {/* Medicamento */}
              <fieldset className="border border-gray-200 rounded-lg p-3">
                <legend className="text-xs font-semibold text-gray-600 px-1">Medicamento</legend>
                <select onChange={e => setMedSelected(medicamentos.find(m => m.med_id === Number(e.target.value)) ?? null)}
                  className="w-full text-xs border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-400">
                  <option value="">-- Seleccionar medicamento --</option>
                  {medicamentos.map(m => (
                    <option key={m.med_id} value={m.med_id}>
                      {m.nombre_generico} {m.concentracion} — Stock: {m.stock_actual} {m.unidad_medida}
                    </option>
                  ))}
                </select>
                {medSelected?.stock_bajo && (
                  <p className="text-xs text-red-600 mt-1">⚠ Stock bajo ({medSelected.stock_actual} {medSelected.unidad_medida})</p>
                )}
              </fieldset>

              {/* Prescripción */}
              <fieldset className="border border-gray-200 rounded-lg p-3">
                <legend className="text-xs font-semibold text-gray-600 px-1">Prescripción</legend>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Médico prescriptor</label>
                    <select value={disForm.medico_prescribe} onChange={e => setDisForm(f => ({ ...f, medico_prescribe: e.target.value }))}
                      className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none">
                      <option value="">-- Opcional --</option>
                      {usuarios.map(u => (
                        <option key={u.usr_id} value={u.usr_id}>{u.primer_nombre} {u.primer_apellido}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Fecha prescripción *</label>
                    <input type="date" value={disForm.fecha_prescripcion}
                      onChange={e => setDisForm(f => ({ ...f, fecha_prescripcion: e.target.value }))}
                      className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Cantidad *</label>
                    <input type="number" step="0.001" min="0" value={disForm.cantidad}
                      onChange={e => setDisForm(f => ({ ...f, cantidad: e.target.value }))} placeholder="Ej: 21"
                      className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Vía administración</label>
                    <select value={disForm.via_admin} onChange={e => setDisForm(f => ({ ...f, via_admin: e.target.value }))}
                      className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none">
                      {['ORAL','INTRAVENOSA','INTRAMUSCULAR','SUBCUTANEA','TOPICA','INHALATORIA','SUBLINGUAL','RECTAL','NASAL','OFTALMICA','OTICA','OTRO'].map(v => (
                        <option key={v} value={v}>{v.charAt(0)+v.slice(1).toLowerCase()}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Dosis</label>
                    <input value={disForm.dosis} onChange={e => setDisForm(f => ({ ...f, dosis: e.target.value }))}
                      placeholder="Ej: 500mg" className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Frecuencia</label>
                    <input value={disForm.frecuencia} onChange={e => setDisForm(f => ({ ...f, frecuencia: e.target.value }))}
                      placeholder="Cada 8 horas" className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Duración (días)</label>
                    <input type="number" min="1" value={disForm.duracion_dias}
                      onChange={e => setDisForm(f => ({ ...f, duracion_dias: e.target.value }))} placeholder="7"
                      className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-500 mb-1">Indicaciones</label>
                    <textarea value={disForm.indicaciones} onChange={e => setDisForm(f => ({ ...f, indicaciones: e.target.value }))}
                      rows={2} placeholder="Tomar con agua, no en ayunas…"
                      className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none resize-none" />
                  </div>
                </div>
              </fieldset>
              {actionError && <p className="text-xs text-red-600 bg-red-50 p-2 rounded">{actionError}</p>}
            </div>
            <div className="flex justify-end gap-3 p-4 border-t border-gray-100">
              <button onClick={() => setShowModalNuevaDis(false)}
                className="px-4 py-2 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Cancelar</button>
              <button onClick={handleNuevaDis} disabled={actionLoading}
                className="px-4 py-2 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {actionLoading ? 'Guardando…' : 'Registrar Dispensación'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Dispensar */}
      {showModalDispensar && selectedDis && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-5 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900">✅ Confirmar Dispensación</h2>
              <p className="text-xs text-gray-500 mt-1">
                {selectedDis.medicamento_nombre} {selectedDis.medicamento_concentracion} × {selectedDis.cantidad}
              </p>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Notas de farmacia (opcional)</label>
                <textarea value={dispensarForm.notas_farmacia}
                  onChange={e => setDispensarForm({ notas_farmacia: e.target.value })}
                  rows={3} placeholder="Turno, lote, observaciones..."
                  className="w-full text-xs border border-gray-200 rounded-md px-3 py-2 focus:outline-none resize-none" />
              </div>
              {actionError && <p className="text-xs text-red-600 bg-red-50 p-2 rounded">{actionError}</p>}
            </div>
            <div className="flex justify-end gap-3 p-4 border-t border-gray-100">
              <button onClick={() => setShowModalDispensar(false)}
                className="px-4 py-2 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Cancelar</button>
              <button onClick={handleDispensar} disabled={actionLoading}
                className="px-4 py-2 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
                {actionLoading ? 'Procesando…' : 'Confirmar Entrega'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Cancelar Dispensación */}
      {showModalCancelarDis && selectedDis && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-5 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900">Cancelar Dispensación</h2>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Motivo de cancelación *</label>
                <textarea value={cancelarDisForm.motivo_cancelacion}
                  onChange={e => setCancelarDisForm({ motivo_cancelacion: e.target.value })}
                  rows={3} placeholder="Explique el motivo…"
                  className="w-full text-xs border border-gray-200 rounded-md px-3 py-2 focus:outline-none resize-none" />
              </div>
              {actionError && <p className="text-xs text-red-600 bg-red-50 p-2 rounded">{actionError}</p>}
            </div>
            <div className="flex justify-end gap-3 p-4 border-t border-gray-100">
              <button onClick={() => setShowModalCancelarDis(false)}
                className="px-4 py-2 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Volver</button>
              <button onClick={handleCancelarDis} disabled={actionLoading || cancelarDisForm.motivo_cancelacion.length < 5}
                className="px-4 py-2 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
                {actionLoading ? 'Cancelando…' : 'Cancelar Dispensación'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Nuevo / Editar Medicamento */}
      {showModalNuevoMed && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900">
                {editMed ? '✏️ Editar Medicamento' : '+ Nuevo Medicamento'}
              </h2>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs text-gray-500 mb-1">Nombre genérico *</label>
                  <input value={medForm.nombre_generico} onChange={e => setMedForm(f => ({ ...f, nombre_generico: e.target.value }))}
                    placeholder="Ej: Amoxicilina"
                    className="w-full text-xs border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Nombre comercial</label>
                  <input value={medForm.nombre_comercial} onChange={e => setMedForm(f => ({ ...f, nombre_comercial: e.target.value }))}
                    placeholder="Ej: Amoxil"
                    className="w-full text-xs border border-gray-200 rounded-md px-3 py-2 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Concentración</label>
                  <input value={medForm.concentracion} onChange={e => setMedForm(f => ({ ...f, concentracion: e.target.value }))}
                    placeholder="Ej: 500mg"
                    className="w-full text-xs border border-gray-200 rounded-md px-3 py-2 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Forma farmacéutica</label>
                  <select value={medForm.forma_farma} onChange={e => setMedForm(f => ({ ...f, forma_farma: e.target.value }))}
                    className="w-full text-xs border border-gray-200 rounded-md px-2 py-2 focus:outline-none">
                    {['TABLETA','CAPSULA','JARABE','INYECTABLE','CREMA','SOLUCION','SUPOSITORIO','GOTAS','PARCHE','OTRO'].map(f => (
                      <option key={f} value={f}>{f.charAt(0)+f.slice(1).toLowerCase()}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Categoría</label>
                  <select value={medForm.categoria} onChange={e => setMedForm(f => ({ ...f, categoria: e.target.value }))}
                    className="w-full text-xs border border-gray-200 rounded-md px-2 py-2 focus:outline-none">
                    {['ANALGESICO','ANTIBIOTICO','ANTIHIPERTENSIVO','ANTIDIABETICO','VITAMINA',
                      'ANTIINFLAMATORIO','CARDIOVASCULAR','NEUROLOGICO','RESPIRATORIO','OTRO'].map(c => (
                      <option key={c} value={c}>{c.charAt(0)+c.slice(1).toLowerCase()}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Unidad de medida</label>
                  <input value={medForm.unidad_medida} onChange={e => setMedForm(f => ({ ...f, unidad_medida: e.target.value }))}
                    placeholder="tableta, capsula, mL…"
                    className="w-full text-xs border border-gray-200 rounded-md px-3 py-2 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Stock actual</label>
                  <input type="number" min="0" value={medForm.stock_actual}
                    onChange={e => setMedForm(f => ({ ...f, stock_actual: e.target.value }))}
                    className="w-full text-xs border border-gray-200 rounded-md px-3 py-2 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Stock mínimo</label>
                  <input type="number" min="0" value={medForm.stock_minimo}
                    onChange={e => setMedForm(f => ({ ...f, stock_minimo: e.target.value }))}
                    className="w-full text-xs border border-gray-200 rounded-md px-3 py-2 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Precio unitario (Q)</label>
                  <input type="number" step="0.01" min="0" value={medForm.precio_unitario}
                    onChange={e => setMedForm(f => ({ ...f, precio_unitario: e.target.value }))}
                    className="w-full text-xs border border-gray-200 rounded-md px-3 py-2 focus:outline-none" />
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <input type="checkbox" id="chk_receta" checked={medForm.requiere_receta}
                    onChange={e => setMedForm(f => ({ ...f, requiere_receta: e.target.checked }))} />
                  <label htmlFor="chk_receta" className="text-xs text-gray-600">Requiere receta médica</label>
                </div>
              </div>
              {actionError && <p className="text-xs text-red-600 bg-red-50 p-2 rounded">{actionError}</p>}
            </div>
            <div className="flex justify-end gap-3 p-4 border-t border-gray-100">
              <button onClick={() => { setShowModalNuevoMed(false); setEditMed(null) }}
                className="px-4 py-2 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Cancelar</button>
              <button onClick={handleGuardarMed} disabled={actionLoading || !medForm.nombre_generico}
                className="px-4 py-2 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {actionLoading ? 'Guardando…' : (editMed ? 'Guardar cambios' : 'Crear Medicamento')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Reponer Stock */}
      {showModalReponer && editMed && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="p-5 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900">📦 Reponer Stock</h2>
              <p className="text-xs text-gray-500 mt-1">
                {editMed.nombre_generico} {editMed.concentracion} — Stock actual: {editMed.stock_actual} {editMed.unidad_medida}
              </p>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Cantidad a agregar *</label>
                <input type="number" min="1" value={reponerForm.cantidad}
                  onChange={e => setReponerForm(f => ({ ...f, cantidad: e.target.value }))} placeholder="Ej: 100"
                  className="w-full text-xs border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-400" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Notas (lote, proveedor…)</label>
                <input value={reponerForm.notas} onChange={e => setReponerForm(f => ({ ...f, notas: e.target.value }))}
                  placeholder="Opcional"
                  className="w-full text-xs border border-gray-200 rounded-md px-3 py-2 focus:outline-none" />
              </div>
              {actionError && <p className="text-xs text-red-600 bg-red-50 p-2 rounded">{actionError}</p>}
            </div>
            <div className="flex justify-end gap-3 p-4 border-t border-gray-100">
              <button onClick={() => { setShowModalReponer(false); setEditMed(null) }}
                className="px-4 py-2 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Cancelar</button>
              <button onClick={handleReponer} disabled={actionLoading || !reponerForm.cantidad || Number(reponerForm.cantidad) < 1}
                className="px-4 py-2 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
                {actionLoading ? 'Procesando…' : 'Confirmar Reposición'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
