import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import PatientList from './pages/patients/PatientList';
import PatientForm from './pages/patients/PatientForm';
import PatientProfile from './pages/patients/PatientProfile';
import AppointmentList from './pages/appointments/AppointmentList';
import AppointmentForm from './pages/appointments/AppointmentForm';
import ClinicalRecordList from './pages/clinical-records/ClinicalRecordList';
import ClinicalRecordForm from './pages/clinical-records/ClinicalRecordForm';
import UserList from './pages/users/UserList';
import UserForm from './pages/users/UserForm';
import LabOrderList from './pages/lab-orders/LabOrderList';
import LabOrderForm from './pages/lab-orders/LabOrderForm';
import PharmacyDashboard from './pages/pharmacy/PharmacyDashboard';
import AppLayout from './components/AppLayout';

const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem('access_token');
  return token ? <AppLayout>{children}</AppLayout> : <Navigate to="/" />;
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />

        {/* Patients */}
        <Route path="/patients" element={<PrivateRoute><PatientList /></PrivateRoute>} />
        <Route path="/patients/new" element={<PrivateRoute><PatientForm /></PrivateRoute>} />
        <Route path="/patients/:id" element={<PrivateRoute><PatientProfile /></PrivateRoute>} />
        <Route path="/patients/:id/edit" element={<PrivateRoute><PatientForm /></PrivateRoute>} />

        {/* Appointments */}
        <Route path="/appointments" element={<PrivateRoute><AppointmentList /></PrivateRoute>} />
        <Route path="/appointments/new" element={<PrivateRoute><AppointmentForm /></PrivateRoute>} />
        <Route path="/appointments/:id/edit" element={<PrivateRoute><AppointmentForm /></PrivateRoute>} />

        {/* Clinical Records */}
        <Route path="/clinical-records" element={<PrivateRoute><ClinicalRecordList /></PrivateRoute>} />
        <Route path="/clinical-records/new" element={<PrivateRoute><ClinicalRecordForm /></PrivateRoute>} />

        {/* Lab Orders */}
        <Route path="/lab-orders" element={<PrivateRoute><LabOrderList /></PrivateRoute>} />
        <Route path="/lab-orders/new" element={<PrivateRoute><LabOrderForm /></PrivateRoute>} />
        <Route path="/lab-orders/:id/edit" element={<PrivateRoute><LabOrderForm /></PrivateRoute>} />

        {/* Pharmacy */}
        <Route path="/pharmacy" element={<PrivateRoute><PharmacyDashboard /></PrivateRoute>} />

        {/* Users */}
        <Route path="/users" element={<PrivateRoute><UserList /></PrivateRoute>} />
        <Route path="/users/new" element={<PrivateRoute><UserForm /></PrivateRoute>} />
      </Routes>
    </Router>
  );
}

export default App;
