import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../axiosConfig';

const ClinicalRecordList = () => {
    const [records, setRecords] = useState([]);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchRecords = async () => {
            try {
                const response = await api.get('/api/clinical-records/');
                setRecords(response.data);
            } catch (err) {
                setError('Error al cargar los historiales clínicos.');
                console.error(err);
            }
        };
        fetchRecords();
    }, []);

    return (
        <div>
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2 className="page-title">Historial Clínico</h2>
                <Link to="/clinical-records/new" className="btn btn-danger fw-bold btn-custom-rounded shadow-sm">
                    <i className="bi bi-file-earmark-medical-fill me-2"></i>Nueva Nota Médica
                </Link>
            </div>

            {error && <div className="alert alert-danger">{error}</div>}

            <div className="row">
                {records.length > 0 ? (
                    records.map((record) => (
                        <div className="col-md-6 mb-4" key={record.id}>
                            <div className="card shadow-sm border-danger border-opacity-25 h-100">
                                <div className="card-header bg-danger bg-opacity-10 py-3">
                                    <div className="d-flex justify-content-between align-items-center">
                                        <h5 className="mb-0 text-danger fw-bold"><i className="bi bi-person-badge me-2"></i>{record.patient_name}</h5>
                                        <small className="text-muted">{new Date(record.created_at).toLocaleDateString()}</small>
                                    </div>
                                </div>
                                <div className="card-body">
                                    <p className="mb-1"><span className="fw-semibold">Médico:</span> {record.doctor_name || 'No asignado'}</p>
                                    <hr />
                                    <h6 className="fw-bold text-secondary">Diagnóstico:</h6>
                                    <p className="card-text">{record.diagnosis}</p>

                                    <h6 className="fw-bold text-secondary mt-3">Notas de Evolución:</h6>
                                    <p className="card-text text-muted">{record.notes}</p>

                                    {record.prescription && (
                                        <>
                                            <h6 className="fw-bold text-success mt-3">Prescripción:</h6>
                                            <p className="card-text text-success bg-success bg-opacity-10 p-2 rounded border border-success border-opacity-25">
                                                {record.prescription}
                                            </p>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="col-12 text-center py-5 bg-white shadow-sm rounded">
                        <i className="bi bi-folder-x fs-1 text-muted mb-3 d-block"></i>
                        <p className="text-muted fs-5">No existen registros clínicos en la base de datos.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ClinicalRecordList;
