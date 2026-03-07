/**
 * HealthTech Solutions — Dashboard Ejecutivo (Fase 11)
 * KPIs en tiempo real de todos los módulos clínicos
 */
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api'
import {
  Users, BedDouble, Calendar, AlertTriangle,
  Scissors, Package, Pill, FlaskConical,
  Stethoscope, Shield, TrendingUp, Activity,
  RefreshCw,
} from 'lucide-react'

// ============================================================
// Types
// ============================================================
interface KPI {
  label:  string
  value:  number
  sub?:   string
  icon:   React.ReactNode
  color:  string
  to:     string
}

interface Encamado {
  enc_id:               number
  paciente_nombre?:     string
  paciente_expediente?: string
  medico_nombre?:       string
  cama_info?:           { numero: string; sala: string }
  dias_estancia_calc?:  number
}

interface Cita {
  cit_id:             number
  paciente_nombre?:   string
  medico_nombre?:     string
  hora_inicio:        string
  hora_fin:           string
  tipo_cita_display?: string
  estado:             string
  estado_display?:    string
  sala?:              string
}

interface AuditoriaItem {
  auditoria_id: number
  tipo_evento:  string
  modulo:       string
  accion?:      string
  exitoso:      boolean
  created_at:   string
}

interface Stats {
  pacientes:    number
  encamados:    number
  citasHoy:     number
  emergencias:  number
  cirugias:     number
  medicamentos: number
  labOrdenes:   number
  stockCritico: number
}

// ============================================================
// Helpers
// ============================================================
function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function fmtTime(t: string): string {
  if (!t) return '—'
  return String(t).slice(0, 5)
}

function fmtDate(dt: string): string {
  if (!dt) return '—'
  return new Date(dt).toLocaleString('es-GT', { dateStyle: 'short', timeStyle: 'short' })
}

const ESTADO_CITA_STYLE: Record<string, string> = {
  PROGRAMADA:  'bg-blue-100 text-blue-800',
  CONFIRMADA:  'bg-teal-100 text-teal-800',
  EN_PROGRESO: 'bg-yellow-100 text-yellow-800',
  COMPLETADA:  'bg-green-100 text-green-800',
  CANCELADA:   'bg-red-100 text-red-800',
  NO_ASISTIO:  'bg-gray-100 text-gray-700',
}

const MODULES = [
  { label: 'Pacientes',    to: '/patients',        icon: <Users className="w-5 h-5" />,          bg: 'bg-blue-500' },
  { label: 'Citas',        to: '/appointments',    icon: <Calendar className="w-5 h-5" />,        bg: 'bg-indigo-500' },
  { label: 'Emergencias',  to: '/emergency',       icon: <AlertTriangle className="w-5 h-5" />,   bg: 'bg-red-500' },
  { label: 'Encamamiento', to: '/hospitalization', icon: <BedDouble className="w-5 h-5" />,       bg: 'bg-teal-500' },
  { label: 'Cirugía',      to: '/surgery',         icon: <Scissors className="w-5 h-5" />,        bg: 'bg-purple-500' },
  { label: 'Laboratorio',  to: '/laboratory',      icon: <FlaskConical className="w-5 h-5" />,    bg: 'bg-cyan-500' },
  { label: 'Farmacia',     to: '/pharmacy',        icon: <Pill className="w-5 h-5" />,            bg: 'bg-green-500' },
  { label: 'Bodega',       to: '/warehouse',       icon: <Package className="w-5 h-5" />,         bg: 'bg-amber-500' },
  { label: 'Enfermería',   to: '/nursing',         icon: <Stethoscope className="w-5 h-5" />,     bg: 'bg-rose-500' },
  { label: 'Seguridad',    to: '/security',        icon: <Shield className="w-5 h-5" />,          bg: 'bg-gray-600' },
]

// ============================================================
// Main
// ============================================================
export default function DashboardPage() {
  const [stats, setStats]         = useState<Stats | null>(null)
  const [encamados, setEncamados] = useState<Encamado[]>([])
  const [citas, setCitas]         = useState<Cita[]>([])
  const [auditoria, setAuditoria] = useState<AuditoriaItem[]>([])
  const [loading, setLoading]     = useState(true)
  const [updatedAt, setUpdatedAt] = useState(new Date())

  const load = async () => {
    setLoading(true)
    try {
      const [
        resPac, resEnc, resCitas, resEmg,
        resCir, resMed, resLab, resBod, resAud,
      ] = await Promise.allSettled([
        api.get('/patients/',               { params: { page_size: 1 } }),
        api.get('/hospitalization/',        { params: { estado: 'INGRESADO', page_size: 5 } }),
        api.get('/appointments/',          { params: { fecha_cita: today(), page_size: 5 } }),
        api.get('/emergency/',             { params: { page_size: 1 } }),
        api.get('/surgery/',               { params: { page_size: 1 } }),
        api.get('/pharmacy/medicamentos/', { params: { page_size: 1 } }),
        api.get('/laboratory/',            { params: { page_size: 1 } }),
        api.get('/warehouse/productos/',   { params: { page_size: 100 } }),
        api.get('/auth/auditoria/',        { params: { page_size: 5 } }),
      ])

      const cnt = (r: PromiseSettledResult<any>) =>
        r.status === 'fulfilled' ? (r.value.data.count ?? 0) : 0

      let stockCritico = 0
      if (resBod.status === 'fulfilled') {
        stockCritico = (resBod.value.data.results ?? [])
          .filter((p: any) => p.estado_stock === 'CRITICO').length
      }

      setStats({
        pacientes:    cnt(resPac),
        encamados:    cnt(resEnc),
        citasHoy:     cnt(resCitas),
        emergencias:  cnt(resEmg),
        cirugias:     cnt(resCir),
        medicamentos: cnt(resMed),
        labOrdenes:   cnt(resLab),
        stockCritico,
      })

      if (resEnc.status   === 'fulfilled') setEncamados(resEnc.value.data.results   ?? [])
      if (resCitas.status === 'fulfilled') setCitas(resCitas.value.data.results     ?? [])
      if (resAud.status   === 'fulfilled') setAuditoria(resAud.value.data.results   ?? [])

      setUpdatedAt(new Date())
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, []) // eslint-disable-line

  const kpis: KPI[] = stats ? [
    { label: 'Pacientes',    value: stats.pacientes,    sub: 'registrados',       icon: <Users className="w-6 h-6" />,          color: 'bg-blue-50 text-blue-700 border-blue-200',     to: '/patients' },
    { label: 'Encamados',    value: stats.encamados,    sub: 'activos',           icon: <BedDouble className="w-6 h-6" />,       color: 'bg-teal-50 text-teal-700 border-teal-200',     to: '/hospitalization' },
    { label: 'Citas Hoy',    value: stats.citasHoy,     sub: 'programadas hoy',   icon: <Calendar className="w-6 h-6" />,        color: 'bg-indigo-50 text-indigo-700 border-indigo-200', to: '/appointments' },
    { label: 'Emergencias',  value: stats.emergencias,  sub: 'registradas',       icon: <AlertTriangle className="w-6 h-6" />,   color: 'bg-red-50 text-red-700 border-red-200',        to: '/emergency' },
    { label: 'Cirugías',     value: stats.cirugias,     sub: 'registradas',       icon: <Scissors className="w-6 h-6" />,        color: 'bg-purple-50 text-purple-700 border-purple-200', to: '/surgery' },
    {
      label: 'Stock Crítico', value: stats.stockCritico, sub: 'sin inventario',
      icon: <Package className="w-6 h-6" />,
      color: stats.stockCritico > 0 ? 'bg-orange-50 text-orange-700 border-orange-300' : 'bg-gray-50 text-gray-600 border-gray-200',
      to: '/warehouse',
    },
  ] : []

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard Ejecutivo</h1>
          <p className="text-sm text-gray-500">
            {new Date().toLocaleDateString('es-GT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Cargando...' : updatedAt.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })}
        </button>
      </div>

      {/* ── KPI Cards ── */}
      {loading && !stats ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {kpis.map(k => (
            <Link key={k.label} to={k.to}
              className={`rounded-xl border p-4 flex flex-col gap-2 hover:shadow-md transition-shadow ${k.color}`}>
              <div className="flex items-center justify-between">
                {k.icon}
                <TrendingUp className="w-3 h-3 opacity-30" />
              </div>
              <p className="text-3xl font-bold">{k.value}</p>
              <div>
                <p className="text-xs font-semibold leading-tight">{k.label}</p>
                {k.sub && <p className="text-xs opacity-60">{k.sub}</p>}
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* ── Two-column tables ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Pacientes Encamados */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <BedDouble className="w-4 h-4 text-teal-600" />
              <h2 className="text-sm font-semibold text-gray-800">Pacientes Encamados</h2>
              {stats && (
                <span className="px-1.5 py-0.5 text-xs bg-teal-100 text-teal-700 rounded-full font-medium">
                  {stats.encamados}
                </span>
              )}
            </div>
            <Link to="/hospitalization" className="text-xs text-blue-600 hover:underline">Ver todos →</Link>
          </div>
          {encamados.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Sin pacientes encamados activos</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {encamados.map(e => (
                <div key={e.enc_id} className="px-4 py-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {e.cama_info?.numero || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {e.paciente_nombre || `Enc #${e.enc_id}`}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {e.cama_info?.sala || '—'} · {e.medico_nombre || '—'}
                    </p>
                  </div>
                  <span className="flex-shrink-0 text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                    {e.dias_estancia_calc ?? 0}d
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Citas de hoy */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-600" />
              <h2 className="text-sm font-semibold text-gray-800">Citas de Hoy</h2>
              {stats && (
                <span className="px-1.5 py-0.5 text-xs bg-indigo-100 text-indigo-700 rounded-full font-medium">
                  {stats.citasHoy}
                </span>
              )}
            </div>
            <Link to="/appointments" className="text-xs text-blue-600 hover:underline">Ver todas →</Link>
          </div>
          {citas.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Sin citas programadas para hoy</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {citas.map(c => (
                <div key={c.cit_id} className="px-4 py-3 flex items-center gap-3">
                  <div className="flex-shrink-0 w-12 text-center">
                    <p className="text-sm font-bold text-indigo-700">{fmtTime(c.hora_inicio)}</p>
                    <p className="text-xs text-gray-400">{fmtTime(c.hora_fin)}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {c.paciente_nombre || `Cita #${c.cit_id}`}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {c.medico_nombre || '—'} · {c.tipo_cita_display || '—'}
                      {c.sala ? ` · ${c.sala}` : ''}
                    </p>
                  </div>
                  <span className={`flex-shrink-0 px-2 py-0.5 text-xs font-medium rounded-full ${ESTADO_CITA_STYLE[c.estado] ?? 'bg-gray-100 text-gray-600'}`}>
                    {c.estado_display || c.estado}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Accesos Rápidos */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-gray-500" />
            <h2 className="text-sm font-semibold text-gray-800">Accesos Rápidos</h2>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {MODULES.map(m => (
              <Link key={m.to} to={m.to}
                className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-gray-50 transition-colors group">
                <div className={`w-9 h-9 rounded-lg ${m.bg} flex items-center justify-center text-white group-hover:scale-105 transition-transform`}>
                  {m.icon}
                </div>
                <span className="text-xs text-gray-500 text-center leading-tight">{m.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Stats del sistema */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-gray-500" />
            <h2 className="text-sm font-semibold text-gray-800">Totales del Sistema</h2>
          </div>
          {stats ? (
            <div className="space-y-3">
              {[
                { label: 'Pacientes registrados', value: stats.pacientes,    dot: 'bg-blue-500' },
                { label: 'Medicamentos',          value: stats.medicamentos, dot: 'bg-green-500' },
                { label: 'Órdenes de Lab.',       value: stats.labOrdenes,   dot: 'bg-cyan-500' },
                { label: 'Cirugías',              value: stats.cirugias,     dot: 'bg-purple-500' },
                { label: 'Emergencias',           value: stats.emergencias,  dot: 'bg-red-500' },
              ].map(s => (
                <div key={s.label} className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${s.dot}`} />
                  <span className="text-sm text-gray-600 flex-1">{s.label}</span>
                  <span className="text-sm font-bold text-gray-900">{s.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-4 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          )}
        </div>

        {/* Auditoría reciente */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-gray-500" />
              <h2 className="text-sm font-semibold text-gray-800">Auditoría Reciente</h2>
            </div>
            <Link to="/security" className="text-xs text-blue-600 hover:underline">Ver más →</Link>
          </div>
          {auditoria.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Sin registros recientes</p>
          ) : (
            <div className="space-y-2.5">
              {auditoria.map(a => (
                <div key={a.auditoria_id} className="flex items-start gap-2">
                  <span className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${a.exitoso ? 'bg-green-400' : 'bg-red-400'}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-gray-700 truncate">
                      {a.tipo_evento.replace(/_/g, ' ')}
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                      {a.modulo}{a.accion ? ` · ${a.accion}` : ''} · {fmtDate(a.created_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
