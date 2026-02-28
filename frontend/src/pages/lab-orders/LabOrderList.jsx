import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../axiosConfig';

const LabOrderList = () => {
    const [orders, setOrders] = useState([]);
    const [filter, setFilter] = useState('');

    const fetch = async () => {
        const url = filter ? `/api/lab-orders/?status=${filter}` : '/api/lab-orders/';
        const res = await api.get(url);
        setOrders(res.data);
    };

    useEffect(() => { fetch(); }, [filter]);

    const updateStatus = async (id, status) => {
        await api.patch(`/api/lab-orders/${id}/`, { status });
        fetch();
    };

    const getStatusBadge = (s) => {
        const m = { 'PENDING': 'bg-warning text-dark', 'IN_PROGRESS': 'bg-info', 'COMPLETED': 'bg-success', 'CANCELLED': 'bg-secondary' };
        return <span className={`badge ${m[s]}`}>{s}</span>;
    };

    return (
        <div>
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2 className="page-title">Laboratorio Clínico</h2>
                <Link to="/lab-orders/new" className="btn btn-info fw-bold btn-custom-rounded shadow-sm text-white">
                    <i className="bi bi-plus-circle me-2"></i>Nueva Orden
                </Link>
            </div>

            <div className="d-flex gap-2 mb-4 flex-wrap">
                {[{ v: '', l: 'Todas' }, { v: 'PENDING', l: 'Pendientes' }, { v: 'IN_PROGRESS', l: 'En Proceso' }, { v: 'COMPLETED', l: 'Completadas' }].map(f => (
                    <button key={f.v} className={`btn btn-sm btn-custom-rounded ${filter === f.v ? 'btn-info text-white' : 'btn-outline-secondary'}`} onClick={() => setFilter(f.v)}>{f.l}</button>
                ))}
            </div>

            <div className="card card-standard">
                <div className="card-body p-0 table-responsive">
                    <table className="table table-hover table-custom">
                        <thead className="table-light">
                            <tr><th>Prueba</th><th>Paciente</th><th>Médico</th><th>Prioridad</th><th>Estado</th><th>Resultados</th><th>Acciones</th></tr>
                        </thead>
                        <tbody>
                            {orders.length > 0 ? orders.map(o => (
                                <tr key={o.id}>
                                    <td className="fw-semibold">{o.test_name}</td>
                                    <td>{o.patient_name}</td>
                                    <td>{o.doctor_name}</td>
                                    <td>{o.priority === 'URGENT' ? <span className="badge bg-danger">Urgente</span> : <span className="badge bg-light text-dark">Normal</span>}</td>
                                    <td>{getStatusBadge(o.status)}</td>
                                    <td className="text-truncate" style={{ maxWidth: '150px' }}>{o.results || '-'}</td>
                                    <td>
                                        {o.status === 'PENDING' && <button className="btn btn-sm btn-outline-info me-1" onClick={() => updateStatus(o.id, 'IN_PROGRESS')}><i className="bi bi-play"></i></button>}
                                        {o.status !== 'COMPLETED' && o.status !== 'CANCELLED' && (
                                            <Link to={`/lab-orders/${o.id}/edit`} className="btn btn-sm btn-outline-primary me-1"><i className="bi bi-pencil"></i></Link>
                                        )}
                                    </td>
                                </tr>
                            )) : <tr><td colSpan="7" className="text-center py-4 text-muted">No hay órdenes de laboratorio</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default LabOrderList;
