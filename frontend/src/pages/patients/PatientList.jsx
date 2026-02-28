import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../axiosConfig';

const PatientList = () => {
    const [patients, setPatients] = useState([]);
    const [search, setSearch] = useState('');
    const [error, setError] = useState(null);

    const fetchPatients = async (query = '') => {
        try {
            const url = query ? `/api/patients/?search=${query}` : '/api/patients/';
            const response = await api.get(url);
            setPatients(response.data);
        } catch (err) {
            setError('Error al cargar pacientes.');
        }
    };

    useEffect(() => { fetchPatients(); }, []);

    const handleSearch = (e) => {
        const val = e.target.value;
        setSearch(val);
        fetchPatients(val);
    };

    const handleDelete = async (id) => {
        if (window.confirm('¿Está seguro de eliminar este paciente?')) {
            try {
                await api.delete(`/api/patients/${id}/`);
                fetchPatients(search);
            } catch (err) { setError('Error al eliminar.'); }
        }
    };

    return (
        <div>
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2 className="page-title">Directorio de Pacientes</h2>
                <Link to="/patients/new" className="btn btn-primary fw-bold btn-custom-rounded shadow-sm">
                    <i className="bi bi-person-plus-fill me-2"></i>Nuevo Paciente
                </Link>
            </div>

            {/* Search */}
            <div className="card card-standard mb-4">
                <div className="card-body py-3">
                    <div className="input-group">
                        <span className="input-group-text bg-white"><i className="bi bi-search text-muted"></i></span>
                        <input type="text" className="form-control border-start-0" placeholder="Buscar por nombre, identificación, teléfono o email..." value={search} onChange={handleSearch} />
                        {search && <button className="btn btn-outline-secondary" onClick={() => { setSearch(''); fetchPatients(); }}><i className="bi bi-x-lg"></i></button>}
                    </div>
                </div>
            </div>

            {error && <div className="alert alert-danger">{error}</div>}

            <div className="card card-standard">
                <div className="card-body p-0 table-responsive">
                    <table className="table table-hover table-custom">
                        <thead className="table-light">
                            <tr>
                                <th>Nombre Completo</th>
                                <th>Identificación</th>
                                <th>Género</th>
                                <th>Teléfono</th>
                                <th>Tipo Sangre</th>
                                <th>Estado</th>
                                <th style={{ width: '200px' }}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {patients.length > 0 ? patients.map((p) => (
                                <tr key={p.id}>
                                    <td className="fw-semibold">{p.first_name} {p.last_name}</td>
                                    <td><code>{p.ssn}</code></td>
                                    <td>{p.gender === 'M' ? 'Masculino' : p.gender === 'F' ? 'Femenino' : 'Otro'}</td>
                                    <td>{p.phone}</td>
                                    <td><span className="badge bg-danger bg-opacity-10 text-danger">{p.blood_type || 'N/A'}</span></td>
                                    <td>{p.is_active ? <span className="badge bg-success">Activo</span> : <span className="badge bg-secondary">Inactivo</span>}</td>
                                    <td>
                                        <Link to={`/patients/${p.id}`} className="btn btn-sm btn-outline-info me-1" title="Ver Expediente"><i className="bi bi-folder2-open"></i></Link>
                                        <Link to={`/patients/${p.id}/edit`} className="btn btn-sm btn-outline-primary me-1" title="Editar"><i className="bi bi-pencil"></i></Link>
                                        <button className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(p.id)} title="Eliminar"><i className="bi bi-trash"></i></button>
                                    </td>
                                </tr>
                            )) : (
                                <tr><td colSpan="7" className="text-center py-4 text-muted">
                                    {search ? 'No se encontraron pacientes con esos criterios.' : 'No hay pacientes registrados.'}
                                </td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default PatientList;
