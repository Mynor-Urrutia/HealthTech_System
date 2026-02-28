import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../axiosConfig';

const UserList = () => {
    const [users, setUsers] = useState([]);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const response = await api.get('/api/users/');
                setUsers(response.data);
            } catch (err) {
                setError('Error al cargar la lista de usuarios.');
                console.error(err);
            }
        };
        fetchUsers();
    }, []);

    const getRoleBadge = (role) => {
        switch (role) {
            case 'ADMIN': return <span className="badge bg-dark">Administrador</span>;
            case 'DOCTOR': return <span className="badge bg-primary">Médico</span>;
            case 'NURSE': return <span className="badge bg-info">Enfermería</span>;
            case 'RECEPTIONIST': return <span className="badge bg-warning text-dark">Recepción</span>;
            case 'PATIENT': return <span className="badge bg-secondary">Paciente Web</span>;
            default: return <span className="badge bg-light text-dark">{role}</span>;
        }
    }

    return (
        <div>
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2 className="page-title">Gestión de Personal y Usuarios</h2>
                <Link to="/users/new" className="btn btn-dark fw-bold btn-custom-rounded shadow-sm">
                    <i className="bi bi-person-fill-add me-2"></i>Nuevo Usuario / Médico
                </Link>
            </div>

            {error && <div className="alert alert-danger">{error}</div>}

            <div className="card card-standard">
                <div className="card-body p-0 table-responsive">
                    <table className="table table-hover table-custom">
                        <thead className="table-light">
                            <tr>
                                <th>Nombre Completo</th>
                                <th>Usuario</th>
                                <th>Correo Electrónico</th>
                                <th>Rol en el Sistema</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.length > 0 ? (
                                users.map((user) => (
                                    <tr key={user.id}>
                                        <td className="fw-semibold">{user.first_name} {user.last_name}</td>
                                        <td>{user.username}</td>
                                        <td>{user.email}</td>
                                        <td>{getRoleBadge(user.role)}</td>
                                        <td>
                                            <button className="btn btn-sm btn-outline-primary me-2"><i className="bi bi-pencil"></i></button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="5" className="text-center py-4 text-muted">
                                        Cargando usuarios...
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
    );
};

export default UserList;
