import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../axiosConfig';

const PharmacyDashboard = () => {
    const [medications, setMedications] = useState([]);
    const [orders, setOrders] = useState([]);
    const [activeTab, setActiveTab] = useState('inventory');
    const [search, setSearch] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [medForm, setMedForm] = useState({ name: '', generic_name: '', category: '', stock: 0, unit_price: 0, description: '', requires_prescription: true });
    const [orderForm, setOrderForm] = useState({ patient: '', doctor: '', medication: '', quantity: 1, dosage: '', notes: '' });
    const [patients, setPatients] = useState([]);
    const [doctors, setDoctors] = useState([]);

    const fetchData = async () => {
        const [m, o, p, d] = await Promise.all([
            api.get(search ? `/api/medications/?search=${search}` : '/api/medications/'),
            api.get('/api/pharmacy-orders/'),
            api.get('/api/patients/'),
            api.get('/api/doctors/')
        ]);
        setMedications(m.data); setOrders(o.data); setPatients(p.data); setDoctors(d.data);
    };

    useEffect(() => { fetchData(); }, [search]);

    const handleMedSubmit = async (e) => {
        e.preventDefault();
        await api.post('/api/medications/', medForm);
        setShowForm(false);
        setMedForm({ name: '', generic_name: '', category: '', stock: 0, unit_price: 0, description: '', requires_prescription: true });
        fetchData();
    };

    const handleOrderSubmit = async (e) => {
        e.preventDefault();
        await api.post('/api/pharmacy-orders/', orderForm);
        setOrderForm({ patient: '', doctor: '', medication: '', quantity: 1, dosage: '', notes: '' });
        fetchData();
    };

    const dispenseOrder = async (id) => {
        await api.patch(`/api/pharmacy-orders/${id}/`, { status: 'DISPENSED' });
        fetchData();
    };

    return (
        <div>
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2 className="page-title">Farmacia</h2>
            </div>

            {/* Tabs */}
            <ul className="nav nav-pills mb-4 gap-2">
                {[{ k: 'inventory', l: 'Inventario', i: 'bi-box-seam' }, { k: 'orders', l: 'Órdenes', i: 'bi-receipt' }, { k: 'dispense', l: 'Dispensar', i: 'bi-capsule' }].map(t => (
                    <li className="nav-item" key={t.k}>
                        <button className={`nav-link btn-custom-rounded ${activeTab === t.k ? 'active' : 'text-dark'}`} onClick={() => setActiveTab(t.k)}>
                            <i className={`bi ${t.i} me-1`}></i>{t.l}
                        </button>
                    </li>
                ))}
            </ul>

            {/* Inventory Tab */}
            {activeTab === 'inventory' && (
                <div>
                    <div className="card card-standard mb-4">
                        <div className="card-body py-3 d-flex justify-content-between align-items-center">
                            <div className="input-group" style={{ maxWidth: '400px' }}>
                                <span className="input-group-text bg-white"><i className="bi bi-search text-muted"></i></span>
                                <input type="text" className="form-control border-start-0" placeholder="Buscar medicamento..." value={search} onChange={e => setSearch(e.target.value)} />
                            </div>
                            <button className="btn btn-warning fw-bold btn-custom-rounded" onClick={() => setShowForm(!showForm)}>
                                <i className="bi bi-plus-circle me-2"></i>{showForm ? 'Cancelar' : 'Agregar Medicamento'}
                            </button>
                        </div>
                    </div>

                    {showForm && (
                        <div className="card card-standard mb-4">
                            <div className="card-body p-4">
                                <h6 className="fw-bold mb-3">Registrar Nuevo Medicamento</h6>
                                <form onSubmit={handleMedSubmit}>
                                    <div className="row">
                                        <div className="col-md-4 mb-3">
                                            <label className="form-label fw-semibold">Nombre Comercial</label>
                                            <input type="text" className="form-control" value={medForm.name} onChange={e => setMedForm({ ...medForm, name: e.target.value })} required />
                                        </div>
                                        <div className="col-md-4 mb-3">
                                            <label className="form-label fw-semibold">Nombre Genérico</label>
                                            <input type="text" className="form-control" value={medForm.generic_name} onChange={e => setMedForm({ ...medForm, generic_name: e.target.value })} />
                                        </div>
                                        <div className="col-md-4 mb-3">
                                            <label className="form-label fw-semibold">Categoría</label>
                                            <input type="text" className="form-control" value={medForm.category} onChange={e => setMedForm({ ...medForm, category: e.target.value })} required placeholder="Ej: Analgésico" />
                                        </div>
                                    </div>
                                    <div className="row">
                                        <div className="col-md-3 mb-3">
                                            <label className="form-label fw-semibold">Stock</label>
                                            <input type="number" className="form-control" value={medForm.stock} onChange={e => setMedForm({ ...medForm, stock: parseInt(e.target.value) })} />
                                        </div>
                                        <div className="col-md-3 mb-3">
                                            <label className="form-label fw-semibold">Precio Unitario</label>
                                            <input type="number" step="0.01" className="form-control" value={medForm.unit_price} onChange={e => setMedForm({ ...medForm, unit_price: parseFloat(e.target.value) })} />
                                        </div>
                                        <div className="col-md-3 mb-3 d-flex align-items-end">
                                            <div className="form-check">
                                                <input className="form-check-input" type="checkbox" checked={medForm.requires_prescription} onChange={e => setMedForm({ ...medForm, requires_prescription: e.target.checked })} />
                                                <label className="form-check-label fw-semibold">Requiere Receta</label>
                                            </div>
                                        </div>
                                        <div className="col-md-3 mb-3 d-flex align-items-end">
                                            <button type="submit" className="btn btn-warning fw-bold w-100 btn-custom-rounded">Guardar</button>
                                        </div>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}

                    <div className="card card-standard">
                        <div className="card-body p-0 table-responsive">
                            <table className="table table-hover table-custom">
                                <thead className="table-light">
                                    <tr><th>Medicamento</th><th>Genérico</th><th>Categoría</th><th>Stock</th><th>Precio</th><th>Receta</th></tr>
                                </thead>
                                <tbody>
                                    {medications.map(m => (
                                        <tr key={m.id}>
                                            <td className="fw-semibold">{m.name}</td>
                                            <td>{m.generic_name || '-'}</td>
                                            <td><span className="badge bg-light text-dark">{m.category}</span></td>
                                            <td><span className={`badge ${m.stock <= 10 ? 'bg-danger' : m.stock <= 50 ? 'bg-warning text-dark' : 'bg-success'}`}>{m.stock}</span></td>
                                            <td>${parseFloat(m.unit_price).toFixed(2)}</td>
                                            <td>{m.requires_prescription ? <i className="bi bi-check-circle text-success"></i> : <i className="bi bi-x-circle text-muted"></i>}</td>
                                        </tr>
                                    ))}
                                    {medications.length === 0 && <tr><td colSpan="6" className="text-center py-4 text-muted">Sin medicamentos registrados</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Orders Tab */}
            {activeTab === 'orders' && (
                <div className="card card-standard">
                    <div className="card-body p-0 table-responsive">
                        <table className="table table-hover table-custom">
                            <thead className="table-light"><tr><th>Medicamento</th><th>Paciente</th><th>Dosis</th><th>Cantidad</th><th>Estado</th><th>Acción</th></tr></thead>
                            <tbody>
                                {orders.map(o => (
                                    <tr key={o.id}>
                                        <td className="fw-semibold">{o.medication_name}</td>
                                        <td>{o.patient_name}</td>
                                        <td>{o.dosage}</td>
                                        <td>{o.quantity}</td>
                                        <td><span className={`badge ${o.status === 'DISPENSED' ? 'bg-success' : 'bg-warning text-dark'}`}>{o.status === 'DISPENSED' ? 'Dispensada' : 'Pendiente'}</span></td>
                                        <td>{o.status === 'PENDING' && <button className="btn btn-sm btn-success btn-custom-rounded" onClick={() => dispenseOrder(o.id)}><i className="bi bi-check me-1"></i>Dispensar</button>}</td>
                                    </tr>
                                ))}
                                {orders.length === 0 && <tr><td colSpan="6" className="text-center py-4 text-muted">Sin órdenes</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Dispense Tab */}
            {activeTab === 'dispense' && (
                <div className="card card-standard" style={{ maxWidth: '700px' }}>
                    <div className="card-header-custom fw-bold"><i className="bi bi-capsule me-2"></i>Crear Orden de Despacho</div>
                    <div className="card-body p-4">
                        <form onSubmit={handleOrderSubmit}>
                            <div className="row">
                                <div className="col-md-6 mb-3">
                                    <label className="form-label fw-semibold">Paciente</label>
                                    <select className="form-select" value={orderForm.patient} onChange={e => setOrderForm({ ...orderForm, patient: e.target.value })} required>
                                        <option value="">Seleccione...</option>
                                        {patients.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
                                    </select>
                                </div>
                                <div className="col-md-6 mb-3">
                                    <label className="form-label fw-semibold">Médico</label>
                                    <select className="form-select" value={orderForm.doctor} onChange={e => setOrderForm({ ...orderForm, doctor: e.target.value })} required>
                                        <option value="">Seleccione...</option>
                                        {doctors.map(d => <option key={d.id} value={d.id}>{d.first_name} {d.last_name || d.username}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="row">
                                <div className="col-md-6 mb-3">
                                    <label className="form-label fw-semibold">Medicamento</label>
                                    <select className="form-select" value={orderForm.medication} onChange={e => setOrderForm({ ...orderForm, medication: e.target.value })} required>
                                        <option value="">Seleccione...</option>
                                        {medications.map(m => <option key={m.id} value={m.id}>{m.name} (Stock: {m.stock})</option>)}
                                    </select>
                                </div>
                                <div className="col-md-3 mb-3">
                                    <label className="form-label fw-semibold">Cantidad</label>
                                    <input type="number" className="form-control" min="1" value={orderForm.quantity} onChange={e => setOrderForm({ ...orderForm, quantity: parseInt(e.target.value) })} />
                                </div>
                                <div className="col-md-3 mb-3">
                                    <label className="form-label fw-semibold">Dosificación</label>
                                    <input type="text" className="form-control" value={orderForm.dosage} onChange={e => setOrderForm({ ...orderForm, dosage: e.target.value })} required placeholder="500mg c/8h" />
                                </div>
                            </div>
                            <div className="mb-3">
                                <label className="form-label fw-semibold">Notas</label>
                                <textarea className="form-control" rows="2" value={orderForm.notes} onChange={e => setOrderForm({ ...orderForm, notes: e.target.value })}></textarea>
                            </div>
                            <button type="submit" className="btn btn-warning fw-bold btn-custom-rounded px-4"><i className="bi bi-save me-2"></i>Registrar Orden</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PharmacyDashboard;
