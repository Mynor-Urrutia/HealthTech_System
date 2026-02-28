import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const AppLayout = ({ children }) => {
    const navigate = useNavigate();
    const location = useLocation();

    const handleLogout = () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        navigate('/');
    };

    const navItems = [
        { path: '/dashboard', label: 'Inicio', icon: 'bi-house-door' },
        { path: '/patients', label: 'Pacientes', icon: 'bi-people' },
        { path: '/appointments', label: 'Citas', icon: 'bi-calendar2-week' },
        { path: '/clinical-records', label: 'Historial', icon: 'bi-clipboard2-pulse' },
        { path: '/lab-orders', label: 'Laboratorio', icon: 'bi-droplet-half' },
        { path: '/pharmacy', label: 'Farmacia', icon: 'bi-capsule' },
        { path: '/users', label: 'Personal', icon: 'bi-shield-lock' },
    ];

    const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');

    return (
        <div className="min-vh-100 d-flex flex-column">
            <nav className="navbar navbar-expand-lg navbar-dark navbar-custom py-2">
                <div className="container-fluid px-4">
                    <a className="navbar-brand d-flex align-items-center" onClick={() => navigate('/dashboard')} style={{ cursor: 'pointer' }}>
                        <i className="bi bi-hospital fs-4 me-2"></i>
                        <span className="fw-bold">Health<span className="fw-light">Tech</span></span>
                    </a>

                    <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
                        <span className="navbar-toggler-icon"></span>
                    </button>

                    <div className="collapse navbar-collapse" id="navbarNav">
                        <ul className="navbar-nav me-auto mb-2 mb-lg-0 ms-3">
                            {navItems.map(item => (
                                <li className="nav-item" key={item.path}>
                                    <a
                                        className={`nav-link px-3 ${isActive(item.path) ? 'active fw-bold' : 'opacity-75'}`}
                                        onClick={() => navigate(item.path)}
                                        style={{ cursor: 'pointer', fontSize: '0.9rem' }}
                                    >
                                        <i className={`bi ${item.icon} me-1`}></i>{item.label}
                                    </a>
                                </li>
                            ))}
                        </ul>
                        <div className="d-flex align-items-center gap-3">
                            <span className="text-white-50 small d-none d-lg-inline"><i className="bi bi-shield-check me-1"></i>HIPAA</span>
                            <button onClick={handleLogout} className="btn btn-outline-light btn-sm fw-semibold px-3 rounded-pill">
                                <i className="bi bi-box-arrow-right me-1"></i>Salir
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            <main className="flex-grow-1 py-4">
                <div className="container-fluid px-4">
                    {children}
                </div>
            </main>

            <footer className="bg-white py-3 mt-auto border-top">
                <div className="container text-center text-muted small">
                    &copy; {new Date().getFullYear()} HealthTech Systems &mdash; Sistema de Gestión Hospitalaria HIPAA Compliant
                </div>
            </footer>
        </div>
    );
};

export default AppLayout;
