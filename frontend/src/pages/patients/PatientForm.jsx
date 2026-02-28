import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import api from '../../axiosConfig';

const PatientForm = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEdit = Boolean(id);
    const [formData, setFormData] = useState({
        first_name: '', last_name: '', date_of_birth: '', gender: 'M',
        blood_type: '', ssn: '', phone: '', email: '',
        emergency_contact: '', emergency_phone: '', allergies: '', address: ''
    });
    const [error, setError] = useState(null);

    useEffect(() => {
        if (isEdit) {
            api.get(`/api/patients/${id}/`).then(res => {
                setFormData(res.data);
            }).catch(() => setError('Error cargando datos del paciente.'));
        }
    }, [id]);

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (isEdit) {
                await api.put(`/api/patients/${id}/`, formData);
            } else {
                await api.post('/api/patients/', formData);
            }
            navigate('/patients');
        } catch (err) {
            setError('Error al guardar. Verifique que la identificación no esté duplicada.');
        }
    };

    return (
        <div>
            <h2 className="page-title mb-4">{isEdit ? 'Editar Paciente' : 'Registro de Nuevo Paciente'}</h2>
            {error && <div className="alert alert-danger">{error}</div>}

            <div className="card card-standard" style={{ maxWidth: '900px' }}>
                <div className="card-body p-4">
                    <form onSubmit={handleSubmit}>
                        <h6 className="text-muted text-uppercase fw-bold mb-3"><i className="bi bi-person me-2"></i>Datos Personales</h6>
                        <div className="row">
                            <div className="col-md-4 mb-3">
                                <label className="form-label fw-semibold">Nombres</label>
                                <input type="text" className="form-control" name="first_name" value={formData.first_name} onChange={handleChange} required />
                            </div>
                            <div className="col-md-4 mb-3">
                                <label className="form-label fw-semibold">Apellidos</label>
                                <input type="text" className="form-control" name="last_name" value={formData.last_name} onChange={handleChange} required />
                            </div>
                            <div className="col-md-4 mb-3">
                                <label className="form-label fw-semibold">Fecha de Nacimiento</label>
                                <input type="date" className="form-control" name="date_of_birth" value={formData.date_of_birth} onChange={handleChange} required />
                            </div>
                        </div>
                        <div className="row">
                            <div className="col-md-3 mb-3">
                                <label className="form-label fw-semibold">Género</label>
                                <select className="form-select" name="gender" value={formData.gender} onChange={handleChange}>
                                    <option value="M">Masculino</option>
                                    <option value="F">Femenino</option>
                                    <option value="O">Otro</option>
                                </select>
                            </div>
                            <div className="col-md-3 mb-3">
                                <label className="form-label fw-semibold">Tipo de Sangre</label>
                                <select className="form-select" name="blood_type" value={formData.blood_type || ''} onChange={handleChange}>
                                    <option value="">Seleccione...</option>
                                    {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div className="col-md-3 mb-3">
                                <label className="form-label fw-semibold">Identificación (SSN/DUI)</label>
                                <input type="text" className="form-control" name="ssn" value={formData.ssn} onChange={handleChange} required />
                            </div>
                            <div className="col-md-3 mb-3">
                                <label className="form-label fw-semibold">Teléfono</label>
                                <input type="text" className="form-control" name="phone" value={formData.phone} onChange={handleChange} required />
                            </div>
                        </div>

                        <hr className="my-4" />
                        <h6 className="text-muted text-uppercase fw-bold mb-3"><i className="bi bi-telephone me-2"></i>Contacto y Emergencias</h6>
                        <div className="row">
                            <div className="col-md-4 mb-3">
                                <label className="form-label fw-semibold">Email</label>
                                <input type="email" className="form-control" name="email" value={formData.email || ''} onChange={handleChange} />
                            </div>
                            <div className="col-md-4 mb-3">
                                <label className="form-label fw-semibold">Contacto de Emergencia</label>
                                <input type="text" className="form-control" name="emergency_contact" value={formData.emergency_contact || ''} onChange={handleChange} />
                            </div>
                            <div className="col-md-4 mb-3">
                                <label className="form-label fw-semibold">Tel. Emergencia</label>
                                <input type="text" className="form-control" name="emergency_phone" value={formData.emergency_phone || ''} onChange={handleChange} />
                            </div>
                        </div>

                        <div className="mb-3">
                            <label className="form-label fw-semibold">Dirección</label>
                            <textarea className="form-control" name="address" rows="2" value={formData.address} onChange={handleChange} required></textarea>
                        </div>
                        <div className="mb-3">
                            <label className="form-label fw-semibold text-danger">Alergias Conocidas</label>
                            <textarea className="form-control border-danger border-opacity-25" name="allergies" rows="2" value={formData.allergies || ''} onChange={handleChange} placeholder="Ej: Penicilina, Sulfa, Ninguna conocida"></textarea>
                        </div>

                        <div className="d-flex justify-content-end mt-4">
                            <Link to="/patients" className="btn btn-outline-secondary me-3 btn-custom-rounded">Cancelar</Link>
                            <button type="submit" className="btn btn-primary fw-bold btn-custom-rounded px-4">
                                <i className="bi bi-save me-2"></i>{isEdit ? 'Actualizar' : 'Registrar'} Paciente
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default PatientForm;
