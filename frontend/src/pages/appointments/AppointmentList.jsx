import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import api from '../../axiosConfig';

const AppointmentList = () => {
    const [appointments, setAppointments] = useState([]);
    const [filter, setFilter] = useState('');
    const [error, setError] = useState(null);

    const fetchAppointments = async () => {
        try {
            const url = filter ? `/api/appointments/?status=${filter}` : '/api/appointments/';
            const res = await api.get(url);
            setAppointments(res.data);
        } catch (err) { setError('Error al cargar citas.'); }
    };

    useEffect(() => { fetchAppointments(); }, [filter]);

    const handleStatusChange = async (id, newStatus) => {
        try {
            await api.patch(`/api/appointments/${id}/`, { status: newStatus });
            fetchAppointments();
        } catch (err) { console.error(err); }
    };

    const handleDelete = async (id) => {
        if (window.confirm('¿Eliminar esta cita?')) {
            await api.delete(`/api/appointments/${id}/`);
            fetchAppointments();
        }
    };

    const getStatusBadge = (status) => {
        const map = { 'SCHEDULED': 'bg-primary', 'IN_PROGRESS': 'bg-info', 'COMPLETED': 'bg-success', 'CANCELLED': 'bg-secondary', 'NO_SHOW': 'bg-danger' };
        const labels = { 'SCHEDULED': 'Agendada', 'IN_PROGRESS': 'En Curso', 'COMPLETED': 'Completada', 'CANCELLED': 'Cancelada', 'NO_SHOW': 'No Asistió' };
        return <span className={`badge ${map[status]}`}>{labels[status]}</span>;
    };

    return (
        <div>
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2 className="page-title">Gestión de Citas Médicas</h2>
                <Link to="/appointments/new" className="btn btn-success fw-bold btn-custom-rounded shadow-sm">
                    <i className="bi bi-calendar-plus-fill me-2"></i>Agendar Cita
                </Link>
            </div>

            {/* Filter Tabs */}
            <div className="d-flex gap-2 mb-4 flex-wrap">
                {[{ v: '', l: 'Todas' }, { v: 'SCHEDULED', l: 'Agendadas' }, { v: 'IN_PROGRESS', l: 'En Curso' }, { v: 'COMPLETED', l: 'Completadas' }, { v: 'CANCELLED', l: 'Canceladas' }].map(f => (
                    <button key={f.v} className={`btn btn-sm btn-custom-rounded ${filter === f.v ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setFilter(f.v)}>{f.l}</button>
                ))}
            </div>

            {error && <div className="alert alert-danger">{error}</div>}

            <div className="card card-standard">
                <div className="card-body p-0 table-responsive">
                    <table className="table table-hover table-custom">
                        <thead className="table-light">
                            <tr>
                                <th>Paciente</th>
                                <th>Médico</th>
                                <th>Fecha y Hora</th>
                                <th>Motivo</th>
                                <th>Estado</th>
                                <th style={{ width: '260px' }}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {appointments.length > 0 ? appointments.map(a => (
                                <tr key={a.id}>
                                    <td className="fw-semibold">{a.patient_name}</td>
                                    <td>{a.doctor_name}</td>
                                    <td>{new Date(a.date_time).toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                                    <td className="text-truncate" style={{ maxWidth: '200px' }}>{a.reason}</td>
                                    <td>{getStatusBadge(a.status)}</td>
                                    <td>
                                        <div className="btn-group btn-group-sm me-2">
                                            {a.status === 'SCHEDULED' && <button className="btn btn-outline-info" onClick={() => handleStatusChange(a.id, 'IN_PROGRESS')} title="Iniciar"><i className="bi bi-play-fill"></i></button>}
                                            {(a.status === 'SCHEDULED' || a.status === 'IN_PROGRESS') && <button className="btn btn-outline-success" onClick={() => handleStatusChange(a.id, 'COMPLETED')} title="Completar"><i className="bi bi-check-lg"></i></button>}
                                            {a.status === 'SCHEDULED' && <button className="btn btn-outline-warning" onClick={() => handleStatusChange(a.id, 'CANCELLED')} title="Cancelar"><i className="bi bi-x-lg"></i></button>}
                                        </div>
                                        <Link to={`/appointments/${a.id}/edit`} className="btn btn-sm btn-outline-primary me-1"><i className="bi bi-pencil"></i></Link>
                                        <button className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(a.id)}><i className="bi bi-trash"></i></button>
                                    </td>
                                </tr>
                            )) : <tr><td colSpan="6" className="text-center py-4 text-muted">No hay citas registradas</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default AppointmentList;
