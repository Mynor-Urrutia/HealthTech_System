import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../axiosConfig';

const UserForm = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        first_name: '',
        last_name: '',
        email: '',
        role: 'DOCTOR'
    });
    const [error, setError] = useState(null);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.post('/api/users/', formData);
            navigate('/users');
        } catch (err) {
            setError('Error al registrar al usuario. Es posible que el nombre de usuario ya exista u ocurriera un error en el servidor.');
            console.error(err.response?.data);
        }
    };

    return (
        <div>
            <h2 className="page-title mb-4">Registrar Nuevo Miembro del Personal</h2>
            {error && <div className="alert alert-danger">{error}</div>}

            <div className="card card-standard" style={{ maxWidth: '800px' }}>
                <div className="card-body p-4">
                    <form onSubmit={handleSubmit}>

                        <div className="row">
                            <div className="col-md-6 mb-3">
                                <label className="form-label fw-semibold">Nombre de Usuario (Login)</label>
                                <input type="text" className="form-control" name="username" value={formData.username} onChange={handleChange} required />
                            </div>
                            <div className="col-md-6 mb-3">
                                <label className="form-label fw-semibold">Contraseña Temporal</label>
                                <input type="password" className="form-control" name="password" value={formData.password} onChange={handleChange} required minLength="8" />
                            </div>
                        </div>

                        <div className="row">
                            <div className="col-md-6 mb-3">
                                <label className="form-label fw-semibold">Nombres</label>
                                <input type="text" className="form-control" name="first_name" value={formData.first_name} onChange={handleChange} required />
                            </div>
                            <div className="col-md-6 mb-3">
                                <label className="form-label fw-semibold">Apellidos</label>
                                <input type="text" className="form-control" name="last_name" value={formData.last_name} onChange={handleChange} required />
                            </div>
                        </div>

                        <div className="mb-3">
                            <label className="form-label fw-semibold">Correo Electrónico</label>
                            <input type="email" className="form-control" name="email" value={formData.email} onChange={handleChange} required />
                        </div>

                        <div className="mb-4">
                            <label className="form-label fw-semibold">Rol Asignado en el Sistema</label>
                            <select className="form-select" name="role" value={formData.role} onChange={handleChange} required>
                                <option value="ADMIN">Administrador</option>
                                <option value="DOCTOR">Médico / Especialista</option>
                                <option value="NURSE">Personal de Enfermería</option>
                                <option value="RECEPTIONIST">Recepción (Front Desk)</option>
                                <option value="PATIENT">Acceso Paciente</option>
                            </select>
                        </div>

                        <div className="d-flex justify-content-end">
                            <Link to="/users" className="btn btn-outline-secondary me-3">Cancelar</Link>
                            <button type="submit" className="btn btn-dark fw-bold px-4">Agregar Personal</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default UserForm;
