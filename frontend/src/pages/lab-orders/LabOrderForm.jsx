import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import api from '../../axiosConfig';

const LabOrderForm = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEdit = Boolean(id);
    const [patients, setPatients] = useState([]);
    const [doctors, setDoctors] = useState([]);
    const [formData, setFormData] = useState({
        patient: '', doctor: '', test_name: '', description: '', results: '', priority: 'NORMAL', status: 'PENDING'
    });
    const [error, setError] = useState(null);

    useEffect(() => {
        const load = async () => {
            const [p, d] = await Promise.all([api.get('/api/patients/'), api.get('/api/doctors/')]);
            setPatients(p.data); setDoctors(d.data);
            if (isEdit) {
                const res = await api.get(`/api/lab-orders/${id}/`);
                setFormData(res.data);
            }
        };
        load().catch(console.error);
    }, [id]);

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (isEdit) await api.put(`/api/lab-orders/${id}/`, formData);
            else await api.post('/api/lab-orders/', formData);
            navigate('/lab-orders');
        } catch (err) { setError('Error al guardar la orden.'); }
    };

    return (
        <div>
            <h2 className="page-title mb-4">{isEdit ? 'Editar Orden de Laboratorio' : 'Nueva Orden de Laboratorio'}</h2>
            {error && <div className="alert alert-danger">{error}</div>}
            <div className="card card-standard" style={{ maxWidth: '700px' }}>
                <div className="card-body p-4">
                    <form onSubmit={handleSubmit}>
                        <div className="row">
                            <div className="col-md-6 mb-3">
                                <label className="form-label fw-semibold">Paciente</label>
                                <select className="form-select" name="patient" value={formData.patient} onChange={handleChange} required>
                                    <option value="">Seleccione...</option>
                                    {patients.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
                                </select>
                            </div>
                            <div className="col-md-6 mb-3">
                                <label className="form-label fw-semibold">Médico Solicitante</label>
                                <select className="form-select" name="doctor" value={formData.doctor} onChange={handleChange} required>
                                    <option value="">Seleccione...</option>
                                    {doctors.map(d => <option key={d.id} value={d.id}>{d.first_name} {d.last_name || d.username}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="row">
                            <div className="col-md-8 mb-3">
                                <label className="form-label fw-semibold">Nombre de la Prueba</label>
                                <input type="text" className="form-control" name="test_name" value={formData.test_name} onChange={handleChange} required placeholder="Ej: Hemograma Completo, Glucosa en Ayunas" />
                            </div>
                            <div className="col-md-4 mb-3">
                                <label className="form-label fw-semibold">Prioridad</label>
                                <select className="form-select" name="priority" value={formData.priority} onChange={handleChange}>
                                    <option value="NORMAL">Normal</option>
                                    <option value="URGENT">Urgente</option>
                                </select>
                            </div>
                        </div>
                        <div className="mb-3">
                            <label className="form-label fw-semibold">Descripción / Indicaciones</label>
                            <textarea className="form-control" name="description" rows="2" value={formData.description || ''} onChange={handleChange}></textarea>
                        </div>
                        {isEdit && (
                            <>
                                <div className="mb-3">
                                    <label className="form-label fw-semibold text-success">Resultados</label>
                                    <textarea className="form-control border-success" name="results" rows="3" value={formData.results || ''} onChange={handleChange} placeholder="Ingrese los resultados del análisis..."></textarea>
                                </div>
                                <div className="mb-3">
                                    <label className="form-label fw-semibold">Estado</label>
                                    <select className="form-select" name="status" value={formData.status} onChange={handleChange}>
                                        <option value="PENDING">Pendiente</option>
                                        <option value="IN_PROGRESS">En Proceso</option>
                                        <option value="COMPLETED">Completado</option>
                                        <option value="CANCELLED">Cancelado</option>
                                    </select>
                                </div>
                            </>
                        )}
                        <div className="d-flex justify-content-end mt-3">
                            <Link to="/lab-orders" className="btn btn-outline-secondary me-3 btn-custom-rounded">Cancelar</Link>
                            <button type="submit" className="btn btn-info text-white fw-bold btn-custom-rounded px-4">
                                <i className="bi bi-save me-2"></i>{isEdit ? 'Guardar Cambios' : 'Crear Orden'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default LabOrderForm;
