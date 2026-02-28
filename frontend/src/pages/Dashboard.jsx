import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../axiosConfig';

const Dashboard = () => {
    const navigate = useNavigate();
    const [stats, setStats] = useState({ patients: 0, appointments: 0, records: 0, users: 0, labs: 0, meds: 0 });
    const [recentAppointments, setRecentAppointments] = useState([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [p, a, r, u, l, m] = await Promise.all([
                    api.get('/api/patients/'),
                    api.get('/api/appointments/'),
                    api.get('/api/clinical-records/'),
                    api.get('/api/users/'),
                    api.get('/api/lab-orders/'),
                    api.get('/api/medications/')
                ]);
                setStats({
                    patients: p.data.length,
                    appointments: a.data.length,
                    records: r.data.length,
                    users: u.data.length,
                    labs: l.data.length,
                    meds: m.data.length
                });
                setRecentAppointments(a.data.slice(0, 5));
            } catch (e) { console.error("Error loading stats", e); }
        };
        fetchData();
    }, []);

    const kpis = [
        { label: 'Pacientes', value: stats.patients, icon: 'bi-people-fill', cls: 'kpi-primary', link: '/patients' },
        { label: 'Citas', value: stats.appointments, icon: 'bi-calendar-check', cls: 'kpi-success', link: '/appointments' },
        { label: 'Notas Clínicas', value: stats.records, icon: 'bi-file-medical', cls: 'kpi-danger', link: '/clinical-records' },
        { label: 'Laboratorio', value: stats.labs, icon: 'bi-droplet-half', cls: 'kpi-info', link: '/lab-orders' },
        { label: 'Medicamentos', value: stats.meds, icon: 'bi-capsule', cls: 'kpi-warning', link: '/pharmacy' },
        { label: 'Personal', value: stats.users, icon: 'bi-person-badge-fill', cls: 'kpi-dark', link: '/users' },
    ];

    const modules = [
        { title: 'Pacientes', desc: 'Directorio y expedientes completos', icon: 'bi-people', color: 'primary', link: '/patients' },
        { title: 'Citas Médicas', desc: 'Agendar, editar y cancelar citas', icon: 'bi-calendar2-week', color: 'success', link: '/appointments' },
        { title: 'Historial Clínico', desc: 'Notas de evolución y diagnósticos', icon: 'bi-clipboard2-pulse', color: 'danger', link: '/clinical-records' },
        { title: 'Laboratorio', desc: 'Órdenes y resultados de análisis', icon: 'bi-droplet-half', color: 'info', link: '/lab-orders' },
        { title: 'Farmacia', desc: 'Inventario y dispensación de medicamentos', icon: 'bi-capsule', color: 'warning', link: '/pharmacy' },
        { title: 'Personal', desc: 'Administración de médicos y usuarios', icon: 'bi-shield-lock', color: 'dark', link: '/users' },
    ];

    const getStatusBadge = (status) => {
        const map = {
            'SCHEDULED': 'bg-primary', 'IN_PROGRESS': 'bg-info', 'COMPLETED': 'bg-success',
            'CANCELLED': 'bg-secondary', 'NO_SHOW': 'bg-danger'
        };
        const labels = {
            'SCHEDULED': 'Agendada', 'IN_PROGRESS': 'En Curso', 'COMPLETED': 'Completada',
            'CANCELLED': 'Cancelada', 'NO_SHOW': 'No Asistió'
        };
        return <span className={`badge ${map[status] || 'bg-secondary'}`}>{labels[status] || status}</span>;
    };

    return (
        <div>
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h2 className="page-title">Panel de Control</h2>
                    <p className="text-muted mb-0">Resumen general del sistema hospitalario</p>
                </div>
                <div className="text-end text-muted small">
                    <i className="bi bi-clock-history me-1"></i>{new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
            </div>

            {/* KPIs */}
            <div className="row mb-4 g-3">
                {kpis.map((k, i) => (
                    <div className="col-lg-2 col-md-4 col-6" key={i}>
                        <div className={`card kpi-card ${k.cls} h-100 shadow-sm`} style={{ cursor: 'pointer' }} onClick={() => navigate(k.link)}>
                            <div className="card-body py-3">
                                <div className="d-flex justify-content-between align-items-center">
                                    <div>
                                        <div className="text-uppercase small fw-bold opacity-75 mb-1">{k.label}</div>
                                        <h3 className="mb-0 fw-bold">{k.value}</h3>
                                    </div>
                                    <i className={`bi ${k.icon} icon-bg`}></i>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="row g-4">
                {/* Recent appointments */}
                <div className="col-lg-7">
                    <div className="card card-standard h-100">
                        <div className="card-header-custom d-flex justify-content-between align-items-center">
                            <h5 className="fw-bold mb-0"><i className="bi bi-calendar3 me-2 text-primary"></i>Últimas Citas</h5>
                            <button className="btn btn-sm btn-outline-primary btn-custom-rounded" onClick={() => navigate('/appointments')}>Ver todas</button>
                        </div>
                        <div className="card-body p-0">
                            <div className="table-responsive">
                                <table className="table table-custom table-hover mb-0">
                                    <thead className="table-light">
                                        <tr><th>Paciente</th><th>Médico</th><th>Fecha</th><th>Estado</th></tr>
                                    </thead>
                                    <tbody>
                                        {recentAppointments.length > 0 ? recentAppointments.map(a => (
                                            <tr key={a.id}>
                                                <td className="fw-semibold">{a.patient_name}</td>
                                                <td>{a.doctor_name}</td>
                                                <td>{new Date(a.date_time).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                                                <td>{getStatusBadge(a.status)}</td>
                                            </tr>
                                        )) : (
                                            <tr><td colSpan="4" className="text-center text-muted py-4">No hay citas registradas</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Quick Access */}
                <div className="col-lg-5">
                    <div className="card card-standard h-100">
                        <div className="card-header-custom">
                            <h5 className="fw-bold mb-0"><i className="bi bi-grid-fill me-2 text-primary"></i>Acceso Rápido</h5>
                        </div>
                        <div className="card-body">
                            <div className="row g-3">
                                {modules.map((m, i) => (
                                    <div className="col-6" key={i}>
                                        <div className="module-card p-3 rounded-3 text-center h-100" onClick={() => navigate(m.link)} style={{ cursor: 'pointer' }}>
                                            <div className={`bg-${m.color} bg-opacity-10 text-${m.color} rounded-circle d-inline-flex justify-content-center align-items-center mb-2`} style={{ width: '48px', height: '48px' }}>
                                                <i className={`bi ${m.icon} fs-5`}></i>
                                            </div>
                                            <div className="fw-bold small text-dark">{m.title}</div>
                                            <div className="text-muted" style={{ fontSize: '0.7rem' }}>{m.desc}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
