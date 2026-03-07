import { useState, useEffect, useCallback, useRef } from 'react'
import api from '../../services/api'

// ============================================================
// Types
// ============================================================
interface Producto {
  pro_id: number
  codigo: string
  nombre: string
  descripcion?: string
  categoria: string
  categoria_display?: string
  unidad_medida: string
  stock_actual: string
  stock_minimo: string
  stock_maximo: string | null
  precio_unitario?: string
  proveedor?: string
  ubicacion?: string
  estado_stock: string
  activo: boolean
}

interface Movimiento {
  mov_id: number
  tipo_movimiento: string
  tipo_display: string
  producto: number
  producto_nombre: string
  producto_codigo: string
  cantidad: string
  cantidad_anterior: string
  cantidad_posterior: string
  motivo: string
  referencia: string
  departamento: string
  responsable: string
  created_at: string
}

type Tab = 'inventario' | 'movimientos'
type ModalMode = 'entrada' | 'salida' | 'ajuste_positivo' | 'ajuste_negativo' | 'baja' | 'nuevo_producto' | null

// ============================================================
// Helpers
// ============================================================
const ESTADO_STOCK_STYLE: Record<string, string> = {
  CRITICO: 'bg-red-100 text-red-800',
  BAJO:    'bg-yellow-100 text-yellow-800',
  EXCESO:  'bg-purple-100 text-purple-800',
  OK:      'bg-green-100 text-green-800',
}
const ESTADO_STOCK_LABEL: Record<string, string> = {
  CRITICO: 'Crítico',
  BAJO:    'Bajo',
  EXCESO:  'Exceso',
  OK:      'OK',
}

const TIPO_STYLE: Record<string, string> = {
  ENTRADA:         'bg-green-100 text-green-800',
  SALIDA:          'bg-blue-100 text-blue-800',
  AJUSTE_POSITIVO: 'bg-teal-100 text-teal-800',
  AJUSTE_NEGATIVO: 'bg-orange-100 text-orange-800',
  BAJA:            'bg-red-100 text-red-800',
}

const CATEGORIA_CHOICES = [
  { value: 'MATERIAL_MEDICO',   label: 'Material Médico' },
  { value: 'INSUMO_QUIRURGICO', label: 'Insumo Quirúrgico' },
  { value: 'LIMPIEZA',          label: 'Limpieza / Higiene' },
  { value: 'OFICINA',           label: 'Oficina / Administrativo' },
  { value: 'EQUIPO',            label: 'Equipo / Herramienta' },
  { value: 'ALIMENTACION',      label: 'Alimentación' },
  { value: 'OTRO',              label: 'Otro' },
]

const TIPOS_POSITIVOS = ['ENTRADA', 'AJUSTE_POSITIVO']

function fmt(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return '—'
  const n = parseFloat(String(val))
  return isNaN(n) ? '—' : n.toLocaleString('es-GT', { minimumFractionDigits: 0, maximumFractionDigits: 3 })
}

function fmtDate(dt: string): string {
  if (!dt) return '—'
  return new Date(dt).toLocaleString('es-GT', { dateStyle: 'medium', timeStyle: 'short' })
}

// ============================================================
// Main Component
// ============================================================
export default function WarehousePage() {
  const [tab, setTab] = useState<Tab>('inventario')

  // ---- Inventario state ----
  const [productos, setProductos]       = useState<Producto[]>([])
  const [proTotal, setProTotal]         = useState(0)
  const [proPage, setProPage]           = useState(1)
  const [proLoading, setProLoading]     = useState(false)
  const [proSearch, setProSearch]       = useState('')
  const [proCategoria, setProCategoria] = useState('')
  const [proEstado, setProEstado]       = useState('')
  const [selected, setSelected]         = useState<Producto | null>(null)

  // ---- Movimientos del producto seleccionado ----
  const [movProduct, setMovProduct]     = useState<Movimiento[]>([])
  const [movProdLoad, setMovProdLoad]   = useState(false)

  // ---- Movimientos globales state ----
  const [movimientos, setMovimientos]   = useState<Movimiento[]>([])
  const [movTotal, setMovTotal]         = useState(0)
  const [movPage, setMovPage]           = useState(1)
  const [movLoading, setMovLoading]     = useState(false)
  const [movTipo, setMovTipo]           = useState('')
  const [movSearch, setMovSearch]       = useState('')

  // ---- Modal ----
  const [modalMode, setModalMode]       = useState<ModalMode>(null)
  const [saving, setSaving]             = useState(false)
  const [modalErr, setModalErr]         = useState('')

  // Form: movimiento
  const [formCantidad, setFormCantidad]     = useState('')
  const [formMotivo, setFormMotivo]         = useState('')
  const [formReferencia, setFormReferencia] = useState('')
  const [formDepto, setFormDepto]           = useState('')

  // Form: nuevo producto
  const [npCodigo, setNpCodigo]         = useState('')
  const [npNombre, setNpNombre]         = useState('')
  const [npDesc, setNpDesc]             = useState('')
  const [npCategoria, setNpCategoria]   = useState('MATERIAL_MEDICO')
  const [npUnidad, setNpUnidad]         = useState('unidad')
  const [npStockAct, setNpStockAct]     = useState('0')
  const [npStockMin, setNpStockMin]     = useState('0')
  const [npStockMax, setNpStockMax]     = useState('')
  const [npPrecio, setNpPrecio]         = useState('0')
  const [npProveedor, setNpProveedor]   = useState('')
  const [npUbicacion, setNpUbicacion]   = useState('')

  const proSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const movSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const PAGE_SIZE = 20

  // ============================================================
  // Fetch productos
  // ============================================================
  const fetchProductos = useCallback(async (page = 1, replace = false) => {
    setProLoading(true)
    try {
      const params: Record<string, string | number> = {
        page, page_size: PAGE_SIZE,
        ordering: 'nombre',
      }
      if (proSearch)   params.search   = proSearch
      if (proCategoria) params.categoria = proCategoria
      const r = await api.get('/warehouse/productos/', { params })
      const data = r.data
      setProTotal(data.count ?? 0)
      setProductos(prev => replace ? (data.results ?? []) : [...prev, ...(data.results ?? [])])
      setProPage(page)
    } catch { /* ignore */ } finally {
      setProLoading(false)
    }
  }, [proSearch, proCategoria])

  // Filter by estado_stock client-side (it's a property, not a DB field)
  const filteredProductos = proEstado
    ? productos.filter(p => p.estado_stock === proEstado)
    : productos

  useEffect(() => {
    setProductos([])
    setSelected(null)
    fetchProductos(1, true)
  }, [proSearch, proCategoria]) // eslint-disable-line

  // ============================================================
  // Fetch movimientos del producto seleccionado
  // ============================================================
  const fetchMovProduct = useCallback(async (proId: number) => {
    setMovProdLoad(true)
    try {
      const r = await api.get('/warehouse/movimientos/', {
        params: { producto: proId, page_size: 15, ordering: '-created_at' },
      })
      setMovProduct(r.data.results ?? [])
    } catch { /* ignore */ } finally {
      setMovProdLoad(false)
    }
  }, [])

  useEffect(() => {
    if (selected) fetchMovProduct(selected.pro_id)
  }, [selected]) // eslint-disable-line

  // ============================================================
  // Fetch movimientos globales
  // ============================================================
  const fetchMovimientos = useCallback(async (page = 1, replace = false) => {
    setMovLoading(true)
    try {
      const params: Record<string, string | number> = {
        page, page_size: PAGE_SIZE, ordering: '-created_at',
      }
      if (movTipo)   params.tipo_movimiento = movTipo
      if (movSearch) params.search          = movSearch
      const r = await api.get('/warehouse/movimientos/', { params })
      const data = r.data
      setMovTotal(data.count ?? 0)
      setMovimientos(prev => replace ? (data.results ?? []) : [...prev, ...(data.results ?? [])])
      setMovPage(page)
    } catch { /* ignore */ } finally {
      setMovLoading(false)
    }
  }, [movTipo, movSearch])

  useEffect(() => {
    if (tab === 'movimientos') {
      setMovimientos([])
      fetchMovimientos(1, true)
    }
  }, [tab, movTipo, movSearch]) // eslint-disable-line

  // ============================================================
  // Handlers
  // ============================================================
  function handleProSearchChange(val: string) {
    if (proSearchTimer.current) clearTimeout(proSearchTimer.current)
    proSearchTimer.current = setTimeout(() => setProSearch(val), 400)
  }

  function handleMovSearchChange(val: string) {
    if (movSearchTimer.current) clearTimeout(movSearchTimer.current)
    movSearchTimer.current = setTimeout(() => setMovSearch(val), 400)
  }

  function openModal(mode: ModalMode) {
    setModalMode(mode)
    setModalErr('')
    setFormCantidad('')
    setFormMotivo('')
    setFormReferencia('')
    setFormDepto('')
    // reset nuevo producto
    setNpCodigo(''); setNpNombre(''); setNpDesc('')
    setNpCategoria('MATERIAL_MEDICO'); setNpUnidad('unidad')
    setNpStockAct('0'); setNpStockMin('0'); setNpStockMax('')
    setNpPrecio('0'); setNpProveedor(''); setNpUbicacion('')
  }

  async function handleSubmitMovimiento() {
    if (!selected) return
    if (!formCantidad || parseFloat(formCantidad) <= 0) {
      setModalErr('La cantidad debe ser mayor que cero.')
      return
    }
    if (!formMotivo.trim()) {
      setModalErr('El motivo es requerido.')
      return
    }
    const tipoMap: Record<string, string> = {
      entrada: 'ENTRADA', salida: 'SALIDA',
      ajuste_positivo: 'AJUSTE_POSITIVO', ajuste_negativo: 'AJUSTE_NEGATIVO',
      baja: 'BAJA',
    }
    setSaving(true)
    setModalErr('')
    try {
      await api.post('/warehouse/movimientos/', {
        producto: selected.pro_id,
        tipo_movimiento: tipoMap[modalMode!],
        cantidad: formCantidad,
        motivo: formMotivo,
        referencia: formReferencia,
        departamento: formDepto,
      })
      setModalMode(null)
      // Refresh selected product
      const r = await api.get(`/warehouse/productos/${selected.pro_id}/`)
      setSelected(r.data)
      setProductos(prev => prev.map(p => p.pro_id === selected.pro_id ? r.data : p))
      fetchMovProduct(selected.pro_id)
    } catch (err: any) {
      const detail = err?.response?.data
      if (typeof detail === 'string') setModalErr(detail)
      else if (detail?.non_field_errors) setModalErr(detail.non_field_errors[0])
      else setModalErr('Error al registrar el movimiento.')
    } finally {
      setSaving(false)
    }
  }

  async function handleSubmitProducto() {
    if (!npNombre.trim()) { setModalErr('El nombre es requerido.'); return }
    setSaving(true); setModalErr('')
    try {
      const payload: Record<string, string | number> = {
        codigo: npCodigo, nombre: npNombre, descripcion: npDesc,
        categoria: npCategoria, unidad_medida: npUnidad,
        stock_actual: npStockAct || '0', stock_minimo: npStockMin || '0',
        precio_unitario: npPrecio || '0',
        proveedor: npProveedor, ubicacion: npUbicacion,
      }
      if (npStockMax) payload.stock_maximo = npStockMax
      await api.post('/warehouse/productos/', payload)
      setModalMode(null)
      setProductos([])
      fetchProductos(1, true)
    } catch (err: any) {
      const d = err?.response?.data
      if (d?.nombre) setModalErr(d.nombre[0])
      else if (d?.stock_actual) setModalErr(d.stock_actual[0])
      else setModalErr('Error al crear el producto.')
    } finally {
      setSaving(false)
    }
  }

  // ============================================================
  // Render
  // ============================================================
  const modalTitle: Record<string, string> = {
    entrada: 'Registrar Entrada',
    salida:  'Registrar Salida',
    ajuste_positivo: 'Ajuste Positivo',
    ajuste_negativo: 'Ajuste Negativo',
    baja: 'Baja / Descarte',
    nuevo_producto: 'Nuevo Producto',
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bodega / Inventario</h1>
          <p className="text-sm text-gray-500">Control de stock e inventario hospitalario</p>
        </div>
        <button
          onClick={() => openModal('nuevo_producto')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          <span className="text-lg leading-none">+</span> Nuevo Producto
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-gray-200">
        {(['inventario', 'movimientos'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'inventario' ? '📦 Inventario' : '📋 Movimientos'}
          </button>
        ))}
      </div>

      {/* ======================================================
          TAB: INVENTARIO
      ====================================================== */}
      {tab === 'inventario' && (
        <div className="flex flex-1 gap-4 min-h-0 overflow-hidden">
          {/* Left: product list */}
          <div className="w-80 flex flex-col gap-3 flex-shrink-0">
            {/* Search */}
            <input
              type="text"
              placeholder="Buscar producto..."
              onChange={e => handleProSearchChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {/* Filters */}
            <div className="flex gap-2">
              <select
                value={proCategoria}
                onChange={e => setProCategoria(e.target.value)}
                className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none"
              >
                <option value="">Todas las categorías</option>
                {CATEGORIA_CHOICES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
              <select
                value={proEstado}
                onChange={e => setProEstado(e.target.value)}
                className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none"
              >
                <option value="">Todo stock</option>
                <option value="CRITICO">Crítico</option>
                <option value="BAJO">Bajo</option>
                <option value="OK">OK</option>
                <option value="EXCESO">Exceso</option>
              </select>
            </div>
            {/* Count */}
            <p className="text-xs text-gray-500">
              {filteredProductos.length} de {proTotal} producto{proTotal !== 1 ? 's' : ''}
            </p>
            {/* List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {filteredProductos.map(p => (
                <div
                  key={p.pro_id}
                  onClick={() => setSelected(p)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    selected?.pro_id === p.pro_id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-white hover:border-blue-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{p.nombre}</p>
                      <p className="text-xs text-gray-500">{p.codigo || '—'} · {p.categoria_display || p.categoria}</p>
                    </div>
                    <span className={`flex-shrink-0 px-1.5 py-0.5 text-xs font-medium rounded-full ${ESTADO_STOCK_STYLE[p.estado_stock] || 'bg-gray-100 text-gray-700'}`}>
                      {ESTADO_STOCK_LABEL[p.estado_stock] || p.estado_stock}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-1 text-xs text-gray-600">
                    <span className="font-semibold">{fmt(p.stock_actual)}</span>
                    <span>{p.unidad_medida}</span>
                    <span className="text-gray-400">/ mín {fmt(p.stock_minimo)}</span>
                  </div>
                </div>
              ))}
              {proLoading && (
                <div className="text-center py-4 text-sm text-gray-500">Cargando...</div>
              )}
              {!proLoading && filteredProductos.length === 0 && (
                <div className="text-center py-8 text-sm text-gray-400">Sin productos</div>
              )}
              {!proLoading && productos.length < proTotal && (
                <button
                  onClick={() => fetchProductos(proPage + 1)}
                  className="w-full py-2 text-sm text-blue-600 hover:underline"
                >
                  Cargar más
                </button>
              )}
            </div>
          </div>

          {/* Right: product detail */}
          <div className="flex-1 overflow-y-auto">
            {!selected ? (
              <div className="h-full flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <p className="text-4xl mb-2">📦</p>
                  <p>Selecciona un producto para ver detalles</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Product header */}
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-lg font-bold text-gray-900">{selected.nombre}</h2>
                      <p className="text-sm text-gray-500">{selected.codigo || 'Sin código'} · {selected.categoria_display || selected.categoria}</p>
                      {selected.descripcion && <p className="mt-1 text-sm text-gray-600">{selected.descripcion}</p>}
                    </div>
                    <span className={`px-2 py-1 text-sm font-medium rounded-full ${ESTADO_STOCK_STYLE[selected.estado_stock]}`}>
                      {ESTADO_STOCK_LABEL[selected.estado_stock]}
                    </span>
                  </div>

                  {/* Stock grid */}
                  <div className="mt-4 grid grid-cols-3 gap-3">
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-gray-500 mb-1">Stock Actual</p>
                      <p className="text-2xl font-bold text-gray-900">{fmt(selected.stock_actual)}</p>
                      <p className="text-xs text-gray-500">{selected.unidad_medida}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-gray-500 mb-1">Stock Mínimo</p>
                      <p className="text-xl font-semibold text-gray-700">{fmt(selected.stock_minimo)}</p>
                      <p className="text-xs text-gray-500">{selected.unidad_medida}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-gray-500 mb-1">Stock Máximo</p>
                      <p className="text-xl font-semibold text-gray-700">{selected.stock_maximo ? fmt(selected.stock_maximo) : '∞'}</p>
                      <p className="text-xs text-gray-500">{selected.unidad_medida}</p>
                    </div>
                  </div>

                  {/* Other info */}
                  <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    {selected.ubicacion && (
                      <div><span className="text-gray-500">Ubicación:</span> <span className="font-medium">{selected.ubicacion}</span></div>
                    )}
                    {selected.proveedor && (
                      <div><span className="text-gray-500">Proveedor:</span> <span className="font-medium">{selected.proveedor}</span></div>
                    )}
                    {selected.precio_unitario && (
                      <div><span className="text-gray-500">Precio unit.:</span> <span className="font-medium">Q{parseFloat(selected.precio_unitario).toFixed(2)}</span></div>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      onClick={() => openModal('entrada')}
                      className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
                    >
                      ↑ Entrada
                    </button>
                    <button
                      onClick={() => openModal('salida')}
                      className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                    >
                      ↓ Salida
                    </button>
                    <button
                      onClick={() => openModal('ajuste_positivo')}
                      className="flex items-center gap-1 px-3 py-1.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700"
                    >
                      + Ajuste+
                    </button>
                    <button
                      onClick={() => openModal('ajuste_negativo')}
                      className="flex items-center gap-1 px-3 py-1.5 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600"
                    >
                      − Ajuste−
                    </button>
                    <button
                      onClick={() => openModal('baja')}
                      className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
                    >
                      ✕ Baja
                    </button>
                  </div>
                </div>

                {/* Recent movements */}
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Últimos movimientos</h3>
                  {movProdLoad ? (
                    <p className="text-sm text-gray-400 text-center py-4">Cargando...</p>
                  ) : movProduct.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">Sin movimientos registrados</p>
                  ) : (
                    <div className="space-y-2">
                      {movProduct.map(m => (
                        <div key={m.mov_id} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
                          <span className={`flex-shrink-0 px-2 py-0.5 text-xs font-medium rounded-full ${TIPO_STYLE[m.tipo_movimiento] || 'bg-gray-100 text-gray-700'}`}>
                            {m.tipo_display}
                          </span>
                          <div className="flex-1 min-w-0">
                            <span className={`text-sm font-semibold ${TIPOS_POSITIVOS.includes(m.tipo_movimiento) ? 'text-green-700' : 'text-red-700'}`}>
                              {TIPOS_POSITIVOS.includes(m.tipo_movimiento) ? '+' : '−'}{fmt(m.cantidad)} {selected.unidad_medida}
                            </span>
                            <span className="text-xs text-gray-500 ml-2">{m.cantidad_anterior} → {m.cantidad_posterior}</span>
                            {m.motivo && <p className="text-xs text-gray-500 truncate">{m.motivo}</p>}
                          </div>
                          <div className="text-right text-xs text-gray-400 flex-shrink-0">
                            <p>{m.responsable}</p>
                            <p>{fmtDate(m.created_at)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================
          TAB: MOVIMIENTOS (global log)
      ====================================================== */}
      {tab === 'movimientos' && (
        <div className="flex-1 flex flex-col gap-3 min-h-0">
          {/* Filters */}
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Buscar producto, motivo, depto..."
              onChange={e => handleMovSearchChange(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={movTipo}
              onChange={e => setMovTipo(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none"
            >
              <option value="">Todos los tipos</option>
              <option value="ENTRADA">Entrada</option>
              <option value="SALIDA">Salida</option>
              <option value="AJUSTE_POSITIVO">Ajuste Positivo</option>
              <option value="AJUSTE_NEGATIVO">Ajuste Negativo</option>
              <option value="BAJA">Baja / Descarte</option>
            </select>
          </div>
          <p className="text-xs text-gray-500">{movTotal} movimiento{movTotal !== 1 ? 's' : ''}</p>

          {/* Table */}
          <div className="flex-1 overflow-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-3 py-2 border-b border-gray-200">ID</th>
                  <th className="px-3 py-2 border-b border-gray-200">Tipo</th>
                  <th className="px-3 py-2 border-b border-gray-200">Producto</th>
                  <th className="px-3 py-2 border-b border-gray-200 text-right">Cantidad</th>
                  <th className="px-3 py-2 border-b border-gray-200 text-right">Antes → Después</th>
                  <th className="px-3 py-2 border-b border-gray-200">Motivo</th>
                  <th className="px-3 py-2 border-b border-gray-200">Departamento</th>
                  <th className="px-3 py-2 border-b border-gray-200">Responsable</th>
                  <th className="px-3 py-2 border-b border-gray-200">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {movimientos.map(m => (
                  <tr key={m.mov_id} className="hover:bg-gray-50 border-b border-gray-100">
                    <td className="px-3 py-2 text-gray-400">#{m.mov_id}</td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${TIPO_STYLE[m.tipo_movimiento] || 'bg-gray-100'}`}>
                        {m.tipo_display}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <p className="font-medium text-gray-900">{m.producto_nombre}</p>
                      <p className="text-xs text-gray-400">{m.producto_codigo}</p>
                    </td>
                    <td className="px-3 py-2 text-right font-semibold">
                      <span className={TIPOS_POSITIVOS.includes(m.tipo_movimiento) ? 'text-green-700' : 'text-red-700'}>
                        {TIPOS_POSITIVOS.includes(m.tipo_movimiento) ? '+' : '−'}{fmt(m.cantidad)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-gray-500 text-xs">
                      {fmt(m.cantidad_anterior)} → {fmt(m.cantidad_posterior)}
                    </td>
                    <td className="px-3 py-2 text-gray-600 max-w-xs truncate">{m.motivo || '—'}</td>
                    <td className="px-3 py-2 text-gray-500">{m.departamento || '—'}</td>
                    <td className="px-3 py-2 text-gray-500">{m.responsable}</td>
                    <td className="px-3 py-2 text-gray-400 text-xs whitespace-nowrap">{fmtDate(m.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {movLoading && <p className="text-center py-4 text-sm text-gray-400">Cargando...</p>}
            {!movLoading && movimientos.length === 0 && (
              <p className="text-center py-8 text-sm text-gray-400">Sin movimientos</p>
            )}
            {!movLoading && movimientos.length < movTotal && (
              <button
                onClick={() => fetchMovimientos(movPage + 1)}
                className="w-full py-3 text-sm text-blue-600 hover:underline"
              >
                Cargar más ({movTotal - movimientos.length} restantes)
              </button>
            )}
          </div>
        </div>
      )}

      {/* ======================================================
          MODAL
      ====================================================== */}
      {modalMode && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">
                {modalTitle[modalMode]}
                {selected && modalMode !== 'nuevo_producto' && (
                  <span className="ml-2 text-sm font-normal text-gray-500">— {selected.nombre}</span>
                )}
              </h2>
              <button onClick={() => setModalMode(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
            </div>

            <div className="px-6 py-4 space-y-4">
              {modalErr && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {modalErr}
                </div>
              )}

              {/* Movimiento form */}
              {modalMode !== 'nuevo_producto' && (
                <>
                  {selected && (
                    <div className="p-3 bg-gray-50 rounded-lg text-sm">
                      <span className="text-gray-500">Stock actual: </span>
                      <span className="font-bold">{fmt(selected.stock_actual)} {selected.unidad_medida}</span>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Cantidad ({selected?.unidad_medida}) *
                    </label>
                    <input
                      type="number" min="0.001" step="0.001"
                      value={formCantidad}
                      onChange={e => setFormCantidad(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Motivo *</label>
                    <input
                      type="text"
                      value={formMotivo}
                      onChange={e => setFormMotivo(e.target.value)}
                      placeholder="Ej: Compra mensual, Solicitud urgencias..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Referencia</label>
                      <input
                        type="text"
                        value={formReferencia}
                        onChange={e => setFormReferencia(e.target.value)}
                        placeholder="OC-2026-001"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Departamento</label>
                      <input
                        type="text"
                        value={formDepto}
                        onChange={e => setFormDepto(e.target.value)}
                        placeholder="Urgencias"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Nuevo producto form */}
              {modalMode === 'nuevo_producto' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Código</label>
                      <input type="text" value={npCodigo} onChange={e => setNpCodigo(e.target.value)}
                        placeholder="BOD-001"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                      <input type="text" value={npNombre} onChange={e => setNpNombre(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                    <input type="text" value={npDesc} onChange={e => setNpDesc(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                      <select value={npCategoria} onChange={e => setNpCategoria(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none">
                        {CATEGORIA_CHOICES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Unidad medida</label>
                      <input type="text" value={npUnidad} onChange={e => setNpUnidad(e.target.value)}
                        placeholder="caja, litro, unidad..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Stock inicial</label>
                      <input type="number" min="0" step="0.001" value={npStockAct} onChange={e => setNpStockAct(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Stock mínimo</label>
                      <input type="number" min="0" step="0.001" value={npStockMin} onChange={e => setNpStockMin(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Stock máximo</label>
                      <input type="number" min="0" step="0.001" value={npStockMax} onChange={e => setNpStockMax(e.target.value)}
                        placeholder="Opcional"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Precio unit.</label>
                      <input type="number" min="0" step="0.01" value={npPrecio} onChange={e => setNpPrecio(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Ubicación</label>
                      <input type="text" value={npUbicacion} onChange={e => setNpUbicacion(e.target.value)}
                        placeholder="Estante A-1"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Proveedor</label>
                    <input type="text" value={npProveedor} onChange={e => setNpProveedor(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setModalMode(null)}
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={modalMode === 'nuevo_producto' ? handleSubmitProducto : handleSubmitMovimiento}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
