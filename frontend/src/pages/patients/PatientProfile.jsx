import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../axiosConfig';

const PatientProfile = () => {
    const { id } = useParams();
    const [patient, setPatient] = useState(null);
    const [activeTab, setActiveTab] = useState('records');
    const [file, setFile] = useState(null);
    const [fileDesc, setFileDesc] = useState('');
    const [fileType, setFileType] = useState('OTHER');

    useEffect(() => {
        api.get(`/api/patients/${id}/full_profile/`).then(res => setPatient(res.data)).catch(console.error);
    }, [id]);

    const handleUpload = async (e) => {
        e.preventDefault();
        const fd = new FormData();
        fd.append('file', file);
        fd.append('description', fileDesc);
        fd.append('file_type', fileType);
        fd.append('patient', id);
        try {
            await api.post('/api/medical-files/', fd);
            const res = await api.get(`/api/patients/${id}/full_profile/`);
            setPatient(res.data);
            setFile(null); setFileDesc(''); setFileType('OTHER');
        } catch (err) { console.error(err); }
    };

    if (!patient) return <div className="text-center py-5"><div className="spinner-border text-primary"></div></div>;

    const tabs = [
        { key: 'records', label: 'Historial Clínico', icon: 'bi-clipboard2-pulse', count: patient.clinical_records?.length || 0 },
        { key: 'appointments', label: 'Citas', icon: 'bi-calendar', count: patient.appointments?.length || 0 },
        { key: 'labs', label: 'Laboratorio', icon: 'bi-droplet-half', count: patient.lab_orders?.length || 0 },
        { key: 'files', label: 'Archivos', icon: 'bi-paperclip', count: patient.medical_files?.length || 0 },
        { key: 'pharmacy', label: 'Farmacia', icon: 'bi-capsule', count: patient.pharmacy_orders?.length || 0 },
    ];

    return (
        <div>
            {/* Patient Header */}
            <div className="card card-standard mb-4">
                <div className="card-body p-4">
                    <div className="row align-items-center">
                        <div className="col-auto">
                            <div className="bg-primary bg-opacity-10 text-primary rounded-circle d-flex justify-content-center align-items-center" style={{ width: '70px', height: '70px' }}>
                                <i className="bi bi-person-fill fs-1"></i>
                            </div>
                        </div>
                        <div className="col">
                            <h3 className="fw-bold mb-1">{patient.first_name} {patient.last_name}</h3>
                            <div className="d-flex flex-wrap gap-3 text-muted small">
                                <span><i className="bi bi-fingerprint me-1"></i>{patient.ssn}</span>
                                <span><i className="bi bi-telephone me-1"></i>{patient.phone}</span>
                                {patient.email && <span><i className="bi bi-envelope me-1"></i>{patient.email}</span>}
                                {patient.blood_type && <span className="badge bg-danger">{patient.blood_type}</span>}
                                <span>{patient.gender === 'M' ? 'Masculino' : patient.gender === 'F' ? 'Femenino' : 'Otro'}</span>
                            </div>
                            {patient.allergies && <div className="mt-2"><span className="badge bg-warning text-dark"><i className="bi bi-exclamation-triangle me-1"></i>Alergias: {patient.allergies}</span></div>}
                        </div>
                        <div className="col-auto">
                            <Link to={`/patients/${id}/edit`} className="btn btn-outline-primary btn-custom-rounded btn-sm"><i className="bi bi-pencil me-1"></i>Editar</Link>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <ul className="nav nav-pills mb-4 gap-2">
                {tabs.map(t => (
                    <li className="nav-item" key={t.key}>
                        <button className={`nav-link btn-custom-rounded ${activeTab === t.key ? 'active' : 'text-dark'}`} onClick={() => setActiveTab(t.key)}>
                            <i className={`bi ${t.icon} me-1`}></i>{t.label} <span className="badge bg-white text-dark ms-1">{t.count}</span>
                        </button>
                    </li>
                ))}
            </ul>

            {/* Tab Content */}
            {activeTab === 'records' && (
                <div className="row g-3">
                    {patient.clinical_records?.length > 0 ? patient.clinical_records.map(r => (
                        <div className="col-md-6" key={r.id}>
                            <div className="card card-standard h-100">
                                <div className="card-body">
                                    <div className="d-flex justify-content-between mb-2"><small className="text-muted">{new Date(r.created_at).toLocaleDateString()}</small><small className="text-muted">Dr. {r.doctor_name}</small></div>
                                    <h6 className="fw-bold text-danger">{r.diagnosis}</h6>
                                    <p className="small text-muted mb-1">{r.notes}</p>
                                    {r.prescription && <p className="small bg-success bg-opacity-10 p-2 rounded text-success">{r.prescription}</p>}
                                </div>
                            </div>
                        </div>
                    )) : <div className="col text-center py-4 text-muted">Sin registros clínicos</div>}
                </div>
            )}

            {activeTab === 'appointments' && (
                <div className="card card-standard">
                    <div className="card-body p-0 table-responsive">
                        <table className="table table-custom table-hover mb-0">
                            <thead className="table-light"><tr><th>Fecha</th><th>Médico</th><th>Motivo</th><th>Estado</th></tr></thead>
                            <tbody>
                                {patient.appointments?.length > 0 ? patient.appointments.map(a => (
                                    <tr key={a.id}>
                                        <td>{new Date(a.date_time).toLocaleString('es-MX')}</td>
                                        <td>{a.doctor_name}</td>
                                        <td>{a.reason}</td>
                                        <td><span className={`badge ${a.status === 'COMPLETED' ? 'bg-success' : a.status === 'CANCELLED' ? 'bg-secondary' : 'bg-primary'}`}>{a.status}</span></td>
                                    </tr>
                                )) : <tr><td colSpan="4" className="text-center py-4 text-muted">Sin citas</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'labs' && (
                <div className="card card-standard">
                    <div className="card-body p-0 table-responsive">
                        <table className="table table-custom table-hover mb-0">
                            <thead className="table-light"><tr><th>Prueba</th><th>Médico</th><th>Estado</th><th>Resultados</th><th>Fecha</th></tr></thead>
                            <tbody>
                                {patient.lab_orders?.length > 0 ? patient.lab_orders.map(l => (
                                    <tr key={l.id}>
                                        <td className="fw-semibold">{l.test_name}</td>
                                        <td>{l.doctor_name}</td>
                                        <td><span className={`badge ${l.status === 'COMPLETED' ? 'bg-success' : l.status === 'PENDING' ? 'bg-warning text-dark' : 'bg-info'}`}>{l.status}</span></td>
                                        <td>{l.results || '-'}</td>
                                        <td>{new Date(l.created_at).toLocaleDateString()}</td>
                                    </tr>
                                )) : <tr><td colSpan="5" className="text-center py-4 text-muted">Sin órdenes de laboratorio</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'files' && (
                <div>
                    <div className="card card-standard mb-4">
                        <div className="card-header-custom fw-bold"><i className="bi bi-cloud-upload me-2"></i>Subir Archivo al Expediente</div>
                        <div className="card-body">
                            <form onSubmit={handleUpload} className="row g-3 align-items-end">
                                <div className="col-md-3">
                                    <label className="form-label fw-semibold small">Tipo</label>
                                    <select className="form-select" value={fileType} onChange={e => setFileType(e.target.value)}>
                                        <option value="LAB_RESULT">Resultado Lab</option>
                                        <option value="IMAGING">Imagen Médica</option>
                                        <option value="PRESCRIPTION">Receta</option>
                                        <option value="REPORT">Informe</option>
                                        <option value="OTHER">Otro</option>
                                    </select>
                                </div>
                                <div className="col-md-3">
                                    <label className="form-label fw-semibold small">Descripción</label>
                                    <input type="text" className="form-control" value={fileDesc} onChange={e => setFileDesc(e.target.value)} required placeholder="Ej: Hemograma Completo" />
                                </div>
                                <div className="col-md-4">
                                    <label className="form-label fw-semibold small">Archivo</label>
                                    <input type="file" className="form-control" onChange={e => setFile(e.target.files[0])} required />
                                </div>
                                <div className="col-md-2">
                                    <button type="submit" className="btn btn-primary w-100 btn-custom-rounded"><i className="bi bi-upload me-1"></i>Subir</button>
                                </div>
                            </form>
                        </div>
                    </div>
                    <div className="card card-standard">
                        <div className="card-body p-0 table-responsive">
                            <table className="table table-custom table-hover mb-0">
                                <thead className="table-light"><tr><th>Descripción</th><th>Tipo</th><th>Subido por</th><th>Fecha</th><th>Acción</th></tr></thead>
                                <tbody>
                                    {patient.medical_files?.length > 0 ? patient.medical_files.map(f => (
                                        <tr key={f.id}>
                                            <td className="fw-semibold">{f.description}</td>
                                            <td><span className="badge bg-info bg-opacity-10 text-info">{f.file_type}</span></td>
                                            <td>{f.uploaded_by_name}</td>
                                            <td>{new Date(f.created_at).toLocaleDateString()}</td>
                                            <td><a href={`http://localhost:8000${f.file}`} target="_blank" className="btn btn-sm btn-outline-primary"><i className="bi bi-download me-1"></i>Descargar</a></td>
                                        </tr>
                                    )) : <tr><td colSpan="5" className="text-center py-4 text-muted">Sin archivos adjuntos</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'pharmacy' && (
                <div className="card card-standard">
                    <div className="card-body p-0 table-responsive">
                        <table className="table table-custom table-hover mb-0">
                            <thead className="table-light"><tr><th>Medicamento</th><th>Dosis</th><th>Cantidad</th><th>Estado</th><th>Fecha</th></tr></thead>
                            <tbody>
                                {patient.pharmacy_orders?.length > 0 ? patient.pharmacy_orders.map(o => (
                                    <tr key={o.id}>
                                        <td className="fw-semibold">{o.medication_name}</td>
                                        <td>{o.dosage}</td>
                                        <td>{o.quantity}</td>
                                        <td><span className={`badge ${o.status === 'DISPENSED' ? 'bg-success' : 'bg-warning text-dark'}`}>{o.status}</span></td>
                                        <td>{new Date(o.created_at).toLocaleDateString()}</td>
                                    </tr>
                                )) : <tr><td colSpan="5" className="text-center py-4 text-muted">Sin órdenes de farmacia</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PatientProfile;
