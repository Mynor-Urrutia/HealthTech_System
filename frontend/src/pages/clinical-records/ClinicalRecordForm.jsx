import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../axiosConfig';

const ClinicalRecordForm = () => {
    const navigate = useNavigate();
    const [patients, setPatients] = useState([]);
    const [doctors, setDoctors] = useState([]);
    const [formData, setFormData] = useState({
        patient: '',
        doctor: '',
        diagnosis: '',
        prescription: '',
        notes: ''
    });
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [patientsRes, doctorsRes] = await Promise.all([
                    api.get('/api/patients/'),
                    api.get('/api/doctors/')
                ]);
                setPatients(patientsRes.data);
                setDoctors(doctorsRes.data);
            } catch (err) {
                console.error('Error fetching data', err);
            }
        };
        fetchData();
    }, []);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.post('/api/clinical-records/', formData);
            navigate('/clinical-records');
        } catch (err) {
            setError('Error al guardar la nota clínica.');
        }
    };

    return (
        <div>
            <h2 className="page-title mb-4">Nueva Nota de Evolución (Historial Clínico)</h2>
            {error && <div className="alert alert-danger">{error}</div>}

            <div className="card card-standard border-danger border-opacity-25">
                <div className="card-header-custom text-danger fw-bold">
                    Registro de Información de Salud Protegida (PHI / HIPAA)
                </div>
                <div className="card-body p-4">
                    <form onSubmit={handleSubmit}>
                        <div className="mb-4">
                            <label className="form-label fw-bold h5">Paciente a Evaluar</label>
                            <select className="form-select form-select-lg" name="patient" value={formData.patient} onChange={handleChange} required>
                                <option value="">Seleccione el paciente...</option>
                                {patients.map(p => (
                                    <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="mb-4">
                            <label className="form-label fw-bold h5">Médico a Cargo</label>
                            <select className="form-select form-select-lg" name="doctor" value={formData.doctor} onChange={handleChange} required>
                                <option value="">Seleccione el médico asignado...</option>
                                {doctors.map(d => (
                                    <option key={d.id} value={d.id}>{d.first_name} {d.last_name || d.username}</option>
                                ))}
                            </select>
                        </div>

                        <hr className="my-4" />

                        <div className="mb-4">
                            <label className="form-label fw-semibold">Diagnóstico Principal</label>
                            <input type="text" className="form-control" name="diagnosis" value={formData.diagnosis} onChange={handleChange} required placeholder="Ej. Faringitis Aguda" />
                        </div>

                        <div className="mb-4">
                            <label className="form-label fw-semibold">Notas Clínicas (Evolución, Síntomas, Observaciones)</label>
                            <textarea className="form-control" name="notes" rows="5" value={formData.notes} onChange={handleChange} required placeholder="Describa los síntomas presentados y las observaciones clínicas detalladas..."></textarea>
                        </div>

                        <div className="mb-4">
                            <label className="form-label fw-semibold text-success">Prescripción Médica (Opcional)</label>
                            <textarea className="form-control border-success" name="prescription" rows="3" value={formData.prescription} onChange={handleChange} placeholder="Medicamentos, dosis y frecuencia..."></textarea>
                        </div>

                        <div className="d-flex justify-content-between align-items-center bg-light p-3 rounded">
                            <small className="text-muted"><i className="bi bi-shield-lock-fill me-1"></i> Esta información será auditada según los estándares HIPAA.</small>
                            <div>
                                <Link to="/clinical-records" className="btn btn-outline-secondary me-3">Cancelar</Link>
                                <button type="submit" className="btn btn-danger fw-bold px-4">Guardar Registro en el Historial</button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ClinicalRecordForm;
