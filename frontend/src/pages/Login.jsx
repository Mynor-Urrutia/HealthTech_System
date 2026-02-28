import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../axiosConfig';

const Login = () => {
    const navigate = useNavigate();
    const [credentials, setCredentials] = useState({ username: '', password: '' });
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            const response = await api.post('/api/token/', credentials);
            localStorage.setItem('access_token', response.data.access);
            localStorage.setItem('refresh_token', response.data.refresh);
            navigate('/dashboard');
        } catch (err) {
            setError('Credenciales inválidas. Verifique su usuario y contraseña.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page d-flex align-items-center justify-content-center min-vh-100">
            <div className="login-container">
                <div className="row g-0 shadow-lg rounded-4 overflow-hidden" style={{ maxWidth: '900px', width: '100%' }}>
                    {/* Left Panel */}
                    <div className="col-md-5 login-brand-panel d-none d-md-flex flex-column justify-content-center align-items-center text-white p-5">
                        <i className="bi bi-hospital fs-1 mb-3" style={{ fontSize: '4rem' }}></i>
                        <h2 className="fw-bold mb-2">HealthTech</h2>
                        <p className="text-center opacity-75 small">Sistema de Gestión Hospitalaria con Cumplimiento HIPAA</p>
                        <div className="mt-4 text-center">
                            <div className="d-flex align-items-center mb-2 small"><i className="bi bi-shield-check me-2"></i>Datos Encriptados</div>
                            <div className="d-flex align-items-center mb-2 small"><i className="bi bi-clipboard2-pulse me-2"></i>Historial Clínico Digital</div>
                            <div className="d-flex align-items-center mb-2 small"><i className="bi bi-people me-2"></i>Gestión de Personal</div>
                        </div>
                    </div>

                    {/* Right Panel - Form */}
                    <div className="col-md-7 bg-white p-5 d-flex flex-column justify-content-center">
                        <h3 className="fw-bold text-dark mb-1">Iniciar Sesión</h3>
                        <p className="text-muted mb-4">Ingrese sus credenciales para acceder al sistema</p>

                        {error && (
                            <div className="alert alert-danger d-flex align-items-center py-2" role="alert">
                                <i className="bi bi-exclamation-triangle-fill me-2"></i>{error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit}>
                            <div className="mb-3">
                                <label className="form-label fw-semibold small text-muted text-uppercase">Usuario</label>
                                <div className="input-group">
                                    <span className="input-group-text bg-light border-end-0"><i className="bi bi-person text-muted"></i></span>
                                    <input
                                        type="text"
                                        className="form-control border-start-0 ps-0"
                                        placeholder="Nombre de usuario"
                                        value={credentials.username}
                                        onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>
                            <div className="mb-4">
                                <label className="form-label fw-semibold small text-muted text-uppercase">Contraseña</label>
                                <div className="input-group">
                                    <span className="input-group-text bg-light border-end-0"><i className="bi bi-lock text-muted"></i></span>
                                    <input
                                        type="password"
                                        className="form-control border-start-0 ps-0"
                                        placeholder="Contraseña segura"
                                        value={credentials.password}
                                        onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>
                            <button type="submit" className="btn btn-primary w-100 py-2 fw-bold btn-custom-rounded" disabled={loading}>
                                {loading ? (
                                    <><span className="spinner-border spinner-border-sm me-2"></span>Verificando...</>
                                ) : (
                                    <><i className="bi bi-box-arrow-in-right me-2"></i>Ingresar al Sistema</>
                                )}
                            </button>
                        </form>

                        <div className="text-center mt-4">
                            <small className="text-muted"><i className="bi bi-shield-lock-fill me-1"></i>Conexión segura y cifrada</small>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
