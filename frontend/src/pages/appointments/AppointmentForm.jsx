import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import api from '../../axiosConfig';

const AppointmentForm = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEdit = Boolean(id);
    const [patients, setPatients] = useState([]);
    const [doctors, setDoctors] = useState([]);
    const [formData, setFormData] = useState({
        patient: '', doctor: '', date_time: '', reason: '', notes: '', status: 'SCHEDULED'
    });
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            const [pRes, dRes] = await Promise.all([api.get('/api/patients/'), api.get('/api/doctors/')]);
            setPatients(pRes.data);
            setDoctors(dRes.data);
            if (isEdit) {
                const res = await api.get(`/api/appointments/${id}/`);
                setFormData({ ...res.data, date_time: res.data.date_time?.slice(0, 16) });
            }
        };
        fetchData().catch(console.error);
    }, [id]);

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (isEdit) await api.put(`/api/appointments/${id}/`, formData);
            else await api.post('/api/appointments/', formData);
            navigate('/appointments');
        } catch (err) { setError('Error al guardar la cita.'); }
    };

    return (
        <div>
            <h2 className="page-title mb-4">{isEdit ? 'Editar Cita' : 'Agendar Nueva Cita Médica'}</h2>
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
                                <label className="form-label fw-semibold">Médico</label>
                                <select className="form-select" name="doctor" value={formData.doctor} onChange={handleChange} required>
                                    <option value="">Seleccione...</option>
                                    {doctors.map(d => <option key={d.id} value={d.id}>{d.first_name} {d.last_name || d.username}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="row">
                            <div className="col-md-6 mb-3">
                                <label className="form-label fw-semibold">Fecha y Hora</label>
                                <input type="datetime-local" className="form-control" name="date_time" value={formData.date_time} onChange={handleChange} required />
                            </div>
                            {isEdit && (
                                <div className="col-md-6 mb-3">
                                    <label className="form-label fw-semibold">Estado</label>
                                    <select className="form-select" name="status" value={formData.status} onChange={handleChange}>
                                        <option value="SCHEDULED">Agendada</option>
                                        <option value="IN_PROGRESS">En Curso</option>
                                        <option value="COMPLETED">Completada</option>
                                        <option value="CANCELLED">Cancelada</option>
                                        <option value="NO_SHOW">No Asistió</option>
                                    </select>
                                </div>
                            )}
                        </div>
                        <div className="mb-3">
                            <label className="form-label fw-semibold">Motivo de la Consulta</label>
                            <textarea className="form-control" name="reason" rows="2" value={formData.reason} onChange={handleChange} required></textarea>
                        </div>
                        <div className="mb-3">
                            <label className="form-label fw-semibold">Notas Adicionales</label>
                            <textarea className="form-control" name="notes" rows="2" value={formData.notes || ''} onChange={handleChange}></textarea>
                        </div>
                        <div className="d-flex justify-content-end mt-3">
                            <Link to="/appointments" className="btn btn-outline-secondary me-3 btn-custom-rounded">Cancelar</Link>
                            <button type="submit" className="btn btn-success fw-bold btn-custom-rounded px-4">
                                <i className="bi bi-save me-2"></i>{isEdit ? 'Actualizar' : 'Agendar'} Cita
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default AppointmentForm;
