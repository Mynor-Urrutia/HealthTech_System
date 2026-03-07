/**
 * HealthTech Solutions — PatientsPage (M02)
 * Ficha clínica de pacientes con HIPAA compliance:
 *   - Listado paginado con búsqueda full-text
 *   - Panel de detalle con datos PHI (solo tras autenticación JWT)
 *   - Modal de registro de nuevo paciente
 *   - Alergias y contactos de emergencia nested
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '@services/api'
import { clsx } from 'clsx'
import {
  Search, Plus, X, User, Phone, FileText, AlertTriangle,
  RefreshCw, ChevronRight, UserCheck, Heart, ClipboardList,
  Shield, BadgeCheck,
} from 'lucide-react'

// ────────────────────────────────────────────────────────────
// Tipos
// ────────────────────────────────────────────────────────────
interface Paciente {
  pac_id: number
  no_expediente: string
  nombre_completo: string
  tipo_documento: string
  no_documento: string
  fecha_nacimiento: string
  edad: number | null
  sexo: 'M' | 'F'
  sexo_display: string
  tipo_paciente: string
  tipo_paciente_display: string
  telefono_principal: string
  activo: boolean
}

interface Alergia {
  alergia_id: number
  tipo_alergia: string
  tipo_alergia_display: string
  agente: string
  reaccion: string
  severidad: string
  severidad_display: string
  verificada: boolean
  fecha_deteccion: string | null
}

interface Contacto {
  contacto_id: number
  nombre_completo: string
  parentesco: string
  telefono: string
  telefono_alt: string
  es_responsable: boolean
}

interface PacienteDetalle extends Paciente {
  hospital_id: number
  primer_nombre: string
  segundo_nombre: string
  primer_apellido: string
  segundo_apellido: string
  nombre_casada: string
  estado_civil: string
  nacionalidad: string
  direccion: string
  municipio: string
  departamento: string
  telefono_alternativo: string
  email: string
  no_afiliacion: string
  aseguradora: string
  grupo_sanguineo: string
  factor_rh: string
  peso_kg: number | null
  talla_cm: number | null
  medico_nombre: string | null
  alergias: Alergia[]
  contactos_emergencia: Contacto[]
  created_at: string
  updated_at: string
}

interface PaginatedResponse {
  count: number
  next: string | null
  previous: string | null
  results: Paciente[]
}

// Estado inicial del formulario
// no_expediente se genera automáticamente en el backend (YYYYMMDDXXX)
const FORM_INICIAL = {
  primer_nombre: '',
  segundo_nombre: '',
  primer_apellido: '',
  segundo_apellido: '',
  tipo_documento: 'DPI',
  no_documento: '',
  fecha_nacimiento: '',
  sexo: 'M',
  estado_civil: 'SOLTERO',
  nacionalidad: 'GUATEMALTECA',
  tipo_paciente: 'GENERAL',
  telefono_principal: '',
  email: '',
}

// Color por severidad de alergia
const severidadColor: Record<string, string> = {
  LEVE: 'bg-yellow-100 text-yellow-800',
  MODERADA: 'bg-orange-100 text-orange-800',
  SEVERA: 'bg-red-100 text-red-800',
  ANAFILACTICA: 'bg-red-200 text-red-900 font-bold ring-1 ring-red-400',
}

// ════════════════════════════════════════════════════════════
// Componente principal
// ════════════════════════════════════════════════════════════
export default function PatientsPage() {
  // Estado listado
  const [pacientes, setPacientes] = useState<Paciente[]>([])
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState('')

  // Estado detalle
  const [selected, setSelected] = useState<PacienteDetalle | null>(null)
  const [detailLoad, setDetailLoad] = useState(false)

  // Modal crear
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<typeof FORM_INICIAL>(FORM_INICIAL)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [expedienteCreado, setExpedienteCreado] = useState<string | null>(null)

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Cargar listado ────────────────────────────────────────
  const fetchPacientes = useCallback(async (q: string, pageNum: number) => {
    setLoading(true)
    setListError('')
    try {
      const params = new URLSearchParams({ page: String(pageNum), page_size: '20' })
      if (q) params.set('search', q)
      const { data } = await api.get<PaginatedResponse | Paciente[]>(`/patients/?${params}`)

      const results = Array.isArray(data) ? data : (data as PaginatedResponse).results
      const count = Array.isArray(data) ? results.length : (data as PaginatedResponse).count

      setPacientes(prev => pageNum === 1 ? results : [...prev, ...results])
      setTotal(count)
      setHasMore(Array.isArray(data) ? false : !!(data as PaginatedResponse).next)
    } catch {
      setListError('No se pudo conectar con el servidor.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchPacientes('', 1) }, [fetchPacientes])

  // ── Búsqueda con debounce ──────────────────────────────────
  const handleSearch = (value: string) => {
    setSearch(value)
    setPage(1)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => fetchPacientes(value, 1), 400)
  }

  // ── Abrir ficha de paciente ────────────────────────────────
  const openDetalle = async (id: number) => {
    setDetailLoad(true)
    setSelected(null)
    try {
      const { data } = await api.get<PacienteDetalle>(`/patients/${id}/`)
      setSelected(data)
    } finally {
      setDetailLoad(false)
    }
  }

  // ── Crear paciente ────────────────────────────────────────
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setFormError('')
    setExpedienteCreado(null)
    try {
      const { data: respData } = await api.post<{ no_expediente?: string }>('/patients/', form)
      const expGenerado = respData?.no_expediente ?? null
      setExpedienteCreado(expGenerado)
      setForm(FORM_INICIAL)
      fetchPacientes(search, 1)
      // Cierra el modal después de 2.5s para que el usuario vea el expediente
      setTimeout(() => {
        setShowModal(false)
        setExpedienteCreado(null)
      }, 2500)
    } catch (err: unknown) {
      const axErr = err as { response?: { data?: unknown } }
      const data = axErr?.response?.data
      if (data && typeof data === 'object') {
        const msgs = Object.entries(data as Record<string, unknown>)
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : String(v)}`)
          .join(' · ')
        setFormError(msgs)
      } else {
        setFormError('Error al guardar. Verifique los datos e intente de nuevo.')
      }
    } finally {
      setSaving(false)
    }
  }

  const setField = (key: string) => (v: string) =>
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
          ? 'hidden lg:flex w-[360px] xl:w-[400px] flex-shrink-0'
          : 'flex flex-1',
      )}>
        {/* Header */}
        <div className="flex-shrink-0 px-4 pt-4 pb-3 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-lg font-bold text-gray-900 leading-tight">Pacientes</h1>
              <p className="text-xs text-gray-400">
                {loading && pacientes.length === 0 ? 'Cargando...' : `${total} registros`}
              </p>
            </div>
            <button
              onClick={() => { setShowModal(true); setFormError('') }}
              className="flex items-center gap-1.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Nuevo
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text" value={search} onChange={e => handleSearch(e.target.value)}
              placeholder="Nombre, expediente, DPI..."
              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:bg-white transition"
            />
          </div>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto">
          {listError && (
            <div className="m-3 p-3 bg-red-50 border border-red-100 rounded-lg flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700 flex-1">{listError}</p>
              <button onClick={() => fetchPacientes(search, 1)} className="text-red-500 hover:text-red-700">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {loading && pacientes.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <div className="h-6 w-6 animate-spin rounded-full border-[3px] border-primary-500 border-t-transparent" />
            </div>
          ) : pacientes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-300">
              <User className="w-12 h-12 mb-2" />
              <p className="text-sm text-gray-400">Sin resultados</p>
            </div>
          ) : (
            <ul>
              {pacientes.map(p => (
                <li key={p.pac_id}>
                  <button
                    onClick={() => openDetalle(p.pac_id)}
                    className={clsx(
                      'w-full text-left px-4 py-3 flex items-center gap-3 transition-colors hover:bg-gray-50',
                      selected?.pac_id === p.pac_id && 'bg-primary-50 border-l-4 border-primary-500 pl-3',
                    )}
                  >
                    <div className={clsx(
                      'w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold',
                      p.sexo === 'F' ? 'bg-pink-100 text-pink-700' : 'bg-blue-100 text-blue-700',
                    )}>
                      {p.nombre_completo.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900 truncate leading-tight">{p.nombre_completo}</p>
                      <p className="text-xs text-gray-500 truncate">
                        Exp.&nbsp;<span className="font-mono">{p.no_expediente}</span>
                        &nbsp;·&nbsp;{p.tipo_documento}&nbsp;{p.no_documento}
                      </p>
                      <p className="text-xs text-gray-400">
                        {p.edad !== null ? `${p.edad} años · ` : ''}{p.tipo_paciente_display}
                      </p>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {hasMore && (
            <button
              onClick={() => { const next = page + 1; setPage(next); fetchPacientes(search, next) }}
              className="w-full py-3 text-xs text-primary-600 hover:bg-primary-50 transition-colors"
            >
              Cargar más registros...
            </button>
          )}
        </div>
      </div>

      {/* ══ PANEL DERECHO — Ficha ══ */}
      {(selected || detailLoad) ? (
        <div className="flex-1 flex flex-col min-w-0 bg-gray-50 overflow-hidden">
          {detailLoad ? (
            <div className="flex items-center justify-center h-full">
              <div className="h-7 w-7 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
            </div>
          ) : selected && (
            <>
              {/* Header ficha */}
              <div className="flex-shrink-0 bg-white border-b border-gray-200 px-5 py-4">
                <div className="flex items-start gap-4">
                  <div className={clsx(
                    'w-14 h-14 rounded-full flex-shrink-0 flex items-center justify-center text-xl font-bold',
                    selected.sexo === 'F' ? 'bg-pink-100 text-pink-700' : 'bg-blue-100 text-blue-700',
                  )}>
                    {selected.nombre_completo.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-base font-bold text-gray-900 leading-tight">{selected.nombre_completo}</h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Exp.&nbsp;<span className="font-mono font-semibold text-gray-700">{selected.no_expediente}</span>
                      &nbsp;·&nbsp;{selected.tipo_documento}&nbsp;{selected.no_documento}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-1.5">
                      <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full font-medium">
                        {selected.tipo_paciente_display}
                      </span>
                      {selected.edad !== null && (
                        <span className="text-xs text-gray-500">{selected.edad}&nbsp;años&nbsp;·&nbsp;{selected.sexo_display}</span>
                      )}
                      {selected.medico_nombre && (
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <UserCheck className="w-3 h-3" />{selected.medico_nombre}
                        </span>
                      )}
                    </div>
                  </div>
                  <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Contenido de la ficha */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                <FichaSeccion icon={<User />} titulo="Datos Personales">
                  <FichaGrid>
                    <FichaCampo label="Fecha de nacimiento" valor={selected.fecha_nacimiento} />
                    <FichaCampo label="Estado civil" valor={selected.estado_civil} />
                    <FichaCampo label="Nacionalidad" valor={selected.nacionalidad} />
                    {selected.nombre_casada && <FichaCampo label="Nombre de casada" valor={selected.nombre_casada} />}
                  </FichaGrid>
                </FichaSeccion>

                <FichaSeccion icon={<Phone />} titulo="Contacto">
                  <FichaGrid>
                    <FichaCampo label="Teléfono" valor={selected.telefono_principal || '—'} />
                    {selected.telefono_alternativo && <FichaCampo label="Teléfono alt." valor={selected.telefono_alternativo} />}
                    {selected.email && <FichaCampo label="Correo" valor={selected.email} />}
                    {(selected.municipio || selected.departamento) && (
                      <FichaCampo label="Municipio / Depto."
                        valor={[selected.municipio, selected.departamento].filter(Boolean).join(', ')} />
                    )}
                    {selected.direccion && <FichaCampo label="Dirección" valor={selected.direccion} span />}
                  </FichaGrid>
                </FichaSeccion>

                {(selected.aseguradora || selected.no_afiliacion) && (
                  <FichaSeccion icon={<Shield />} titulo="Cobertura / Seguro">
                    <FichaGrid>
                      {selected.aseguradora && <FichaCampo label="Aseguradora" valor={selected.aseguradora} />}
                      {selected.no_afiliacion && <FichaCampo label="No. Afiliación" valor={selected.no_afiliacion} />}
                    </FichaGrid>
                  </FichaSeccion>
                )}

                <FichaSeccion icon={<Heart />} titulo="Datos Clínicos">
                  <FichaGrid>
                    {selected.grupo_sanguineo && (
                      <FichaCampo label="Grupo / Factor Rh" valor={`${selected.grupo_sanguineo}${selected.factor_rh}`} />
                    )}
                    {selected.peso_kg && <FichaCampo label="Peso (kg)" valor={String(selected.peso_kg)} />}
                    {selected.talla_cm && <FichaCampo label="Talla (cm)" valor={String(selected.talla_cm)} />}
                    {!selected.grupo_sanguineo && !selected.peso_kg && !selected.talla_cm && (
                      <p className="col-span-2 text-xs text-gray-400">Sin datos clínicos registrados</p>
                    )}
                  </FichaGrid>
                </FichaSeccion>

                <FichaSeccion
                  icon={<AlertTriangle />}
                  titulo={`Alergias (${selected.alergias.length})`}
                  alerta={selected.alergias.some(a => a.severidad === 'ANAFILACTICA')}
                >
                  {selected.alergias.length === 0 ? (
                    <p className="text-xs text-gray-400">Sin alergias registradas</p>
                  ) : (
                    <div className="space-y-2">
                      {selected.alergias.map(a => (
                        <div key={a.alergia_id} className="flex items-start gap-2 p-2.5 bg-white rounded-lg border border-gray-100">
                          <span className={clsx('text-xs px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5', severidadColor[a.severidad] ?? 'bg-gray-100 text-gray-700')}>
                            {a.severidad_display}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-gray-800">{a.agente}</p>
                            <p className="text-xs text-gray-500">{a.tipo_alergia_display}{a.reaccion ? ` · ${a.reaccion}` : ''}</p>
                          </div>
                          {a.verificada && <span title="Verificada"><BadgeCheck className="w-4 h-4 text-green-500 flex-shrink-0" /></span>}
                        </div>
                      ))}
                    </div>
                  )}
                </FichaSeccion>

                <FichaSeccion icon={<Phone />} titulo={`Contactos de Emergencia (${selected.contactos_emergencia.length})`}>
                  {selected.contactos_emergencia.length === 0 ? (
                    <p className="text-xs text-gray-400">Sin contactos registrados</p>
                  ) : (
                    <div className="space-y-2">
                      {selected.contactos_emergencia.map(c => (
                        <div key={c.contacto_id} className="flex items-center gap-3 p-2.5 bg-white rounded-lg border border-gray-100">
                          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                            <User className="w-4 h-4 text-gray-500" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-gray-800">{c.nombre_completo}</p>
                            <p className="text-xs text-gray-500">{c.parentesco} · {c.telefono}</p>
                          </div>
                          {c.es_responsable && (
                            <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full flex-shrink-0">Responsable</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </FichaSeccion>

                <FichaSeccion icon={<FileText />} titulo="Expediente">
                  <FichaGrid>
                    <FichaCampo label="No. Expediente" valor={selected.no_expediente} />
                    <FichaCampo label="Tipo Documento" valor={selected.tipo_documento} />
                    <FichaCampo label="No. Documento" valor={selected.no_documento} />
                    <FichaCampo label="Registrado el" valor={new Date(selected.created_at).toLocaleDateString('es-GT')} />
                  </FichaGrid>
                </FichaSeccion>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="hidden lg:flex flex-1 items-center justify-center flex-col gap-3 text-gray-200 bg-gray-50">
          <ClipboardList className="w-20 h-20" />
          <p className="text-sm text-gray-400">Selecciona un paciente para ver su ficha</p>
        </div>
      )}

      {/* ══ MODAL — Nuevo Paciente ══ */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 flex-shrink-0">
              <h3 className="font-bold text-gray-900">Registrar Nuevo Paciente</h3>
              <button onClick={() => { setShowModal(false); setFormError(''); setExpedienteCreado(null) }} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form id="form-paciente" onSubmit={handleCreate} className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Éxito: expediente generado */}
              {expedienteCreado && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm flex items-center gap-3">
                  <BadgeCheck className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <div>
                    <p className="font-semibold">Paciente registrado exitosamente</p>
                    <p className="text-xs mt-0.5">
                      Expediente asignado:&nbsp;
                      <span className="font-mono font-bold text-green-900">{expedienteCreado}</span>
                    </p>
                  </div>
                </div>
              )}

              {/* Error */}
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {!expedienteCreado && (
                <>
                  <Fieldset legend="Identidad del Paciente">
                    <div className="grid grid-cols-2 gap-3">
                      <FormInput label="Primer nombre *" value={form.primer_nombre} onChange={setField('primer_nombre')} required />
                      <FormInput label="Segundo nombre" value={form.segundo_nombre} onChange={setField('segundo_nombre')} />
                      <FormInput label="Primer apellido *" value={form.primer_apellido} onChange={setField('primer_apellido')} required />
                      <FormInput label="Segundo apellido" value={form.segundo_apellido} onChange={setField('segundo_apellido')} />
                    </div>
                  </Fieldset>

                  <Fieldset legend="Documento de Identidad">
                    {/* No. Expediente es auto-generado por el sistema (formato YYYYMMDDXXX) */}
                    <div className="grid grid-cols-2 gap-3">
                      <FormSelect label="Tipo doc. *" value={form.tipo_documento} onChange={setField('tipo_documento')}
                        options={[['DPI', 'DPI'], ['PASAPORTE', 'Pasaporte'], ['CUI', 'CUI'], ['CEDULA', 'Cédula'], ['OTRO', 'Otro']]} />
                      <FormInput label="No. Documento *" value={form.no_documento} onChange={setField('no_documento')} required />
                    </div>
                    <p className="mt-2 text-xs text-gray-400 flex items-center gap-1">
                      <BadgeCheck className="w-3.5 h-3.5 text-primary-400" />
                      El No. de Expediente se genera automáticamente al guardar (formato YYYYMMDDXXX).
                    </p>
                  </Fieldset>

                  <Fieldset legend="Datos Demográficos">
                    <div className="grid grid-cols-2 gap-3">
                      <FormInput label="Fecha de nacimiento *" value={form.fecha_nacimiento} onChange={setField('fecha_nacimiento')} type="date" required />
                      <FormSelect label="Sexo *" value={form.sexo} onChange={setField('sexo')}
                        options={[['M', 'Masculino'], ['F', 'Femenino']]} />
                      <FormSelect label="Estado civil" value={form.estado_civil} onChange={setField('estado_civil')}
                        options={[['SOLTERO', 'Soltero/a'], ['CASADO', 'Casado/a'], ['UNION_LIBRE', 'Unión libre'], ['DIVORCIADO', 'Divorciado/a'], ['VIUDO', 'Viudo/a']]} />
                      <FormSelect label="Tipo de paciente" value={form.tipo_paciente} onChange={setField('tipo_paciente')}
                        options={[['GENERAL', 'General'], ['IGSS', 'IGSS'], ['PRIVADO', 'Privado'], ['SEGURO', 'Seguro médico'], ['EXTERIOR', 'Exterior'], ['OTRO', 'Otro']]} />
                    </div>
                  </Fieldset>

                  <Fieldset legend="Contacto">
                    <div className="grid grid-cols-2 gap-3">
                      <FormInput label="Teléfono principal" value={form.telefono_principal} onChange={setField('telefono_principal')} type="tel" />
                      <FormInput label="Correo electrónico" value={form.email} onChange={setField('email')} type="email" />
                    </div>
                  </Fieldset>
                </>
              )}
            </form>

            <div className="flex-shrink-0 flex justify-end gap-3 px-5 py-4 border-t border-gray-100 bg-gray-50 rounded-b-xl">
              <button
                type="button"
                onClick={() => { setShowModal(false); setFormError(''); setExpedienteCreado(null) }}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition"
              >
                {expedienteCreado ? 'Cerrar' : 'Cancelar'}
              </button>
              {!expedienteCreado && (
                <button type="submit" form="form-paciente" disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-60">
                  {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Guardar paciente
                </button>
              )}
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
function FichaSeccion({ icon, titulo, alerta = false, children }: {
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

function FichaGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>
}

function FichaCampo({ label, valor, span = false }: { label: string; valor: string; span?: boolean }) {
  return (
    <div className={span ? 'col-span-2' : ''}>
      <p className="text-xs text-gray-400 font-medium leading-none mb-0.5">{label}</p>
      <p className="text-sm text-gray-800 break-words">{valor || '—'}</p>
    </div>
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
        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 transition bg-white" />
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
