from rest_framework import viewsets, filters
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Patient, Appointment, ClinicalRecord, MedicalFile, LabOrder, Medication, PharmacyOrder
from .serializers import (
    PatientSerializer, AppointmentSerializer, ClinicalRecordSerializer,
    MedicalFileSerializer, LabOrderSerializer, MedicationSerializer, PharmacyOrderSerializer
)

class PatientViewSet(viewsets.ModelViewSet):
    queryset = Patient.objects.all().order_by('-created_at')
    serializer_class = PatientSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['first_name', 'last_name', 'ssn', 'phone', 'email']
    ordering_fields = ['first_name', 'last_name', 'created_at']

    @action(detail=True, methods=['get'])
    def full_profile(self, request, pk=None):
        """Devuelve el perfil completo del paciente con historial, citas, labs y archivos"""
        patient = self.get_object()
        data = PatientSerializer(patient).data
        data['appointments'] = AppointmentSerializer(patient.appointments.all().order_by('-date_time'), many=True).data
        data['clinical_records'] = ClinicalRecordSerializer(patient.clinical_records.all().order_by('-created_at'), many=True).data
        data['lab_orders'] = LabOrderSerializer(patient.lab_orders.all().order_by('-created_at'), many=True).data
        data['medical_files'] = MedicalFileSerializer(patient.medical_files.all().order_by('-created_at'), many=True).data
        data['pharmacy_orders'] = PharmacyOrderSerializer(patient.pharmacy_orders.all().order_by('-created_at'), many=True).data
        return Response(data)

class AppointmentViewSet(viewsets.ModelViewSet):
    queryset = Appointment.objects.all().order_by('-date_time')
    serializer_class = AppointmentSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['patient__first_name', 'patient__last_name', 'reason', 'status']

    def get_queryset(self):
        user = self.request.user
        qs = super().get_queryset()
        if getattr(user, 'is_superuser', False) or user.role == 'ADMIN':
            pass
        elif user.role == 'DOCTOR':
            qs = qs.filter(doctor=user)
        # Filter by status if provided
        status = self.request.query_params.get('status')
        if status:
            qs = qs.filter(status=status)
        return qs

class ClinicalRecordViewSet(viewsets.ModelViewSet):
    queryset = ClinicalRecord.objects.all().order_by('-created_at')
    serializer_class = ClinicalRecordSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = super().get_queryset()
        if getattr(user, 'is_superuser', False) or user.role == 'ADMIN':
            pass
        elif user.role == 'DOCTOR':
            qs = qs.filter(doctor=user)
        patient_id = self.request.query_params.get('patient')
        if patient_id:
            qs = qs.filter(patient_id=patient_id)
        return qs

class MedicalFileViewSet(viewsets.ModelViewSet):
    queryset = MedicalFile.objects.all().order_by('-created_at')
    serializer_class = MedicalFileSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def perform_create(self, serializer):
        serializer.save(uploaded_by=self.request.user)

    def get_queryset(self):
        qs = super().get_queryset()
        patient_id = self.request.query_params.get('patient')
        if patient_id:
            qs = qs.filter(patient_id=patient_id)
        return qs

class LabOrderViewSet(viewsets.ModelViewSet):
    queryset = LabOrder.objects.all().order_by('-created_at')
    serializer_class = LabOrderSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter]
    search_fields = ['test_name', 'patient__first_name', 'patient__last_name']

    def get_queryset(self):
        qs = super().get_queryset()
        status = self.request.query_params.get('status')
        if status:
            qs = qs.filter(status=status)
        patient_id = self.request.query_params.get('patient')
        if patient_id:
            qs = qs.filter(patient_id=patient_id)
        return qs

class MedicationViewSet(viewsets.ModelViewSet):
    queryset = Medication.objects.all().order_by('name')
    serializer_class = MedicationSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'generic_name', 'category']

class PharmacyOrderViewSet(viewsets.ModelViewSet):
    queryset = PharmacyOrder.objects.all().order_by('-created_at')
    serializer_class = PharmacyOrderSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter]
    search_fields = ['patient__first_name', 'patient__last_name', 'medication__name']

    def get_queryset(self):
        qs = super().get_queryset()
        patient_id = self.request.query_params.get('patient')
        if patient_id:
            qs = qs.filter(patient_id=patient_id)
        return qs
