from rest_framework import serializers
from .models import Patient, Appointment, ClinicalRecord, MedicalFile, LabOrder, Medication, PharmacyOrder

class PatientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Patient
        fields = '__all__'

class AppointmentSerializer(serializers.ModelSerializer):
    doctor_name = serializers.CharField(source='doctor.get_full_name', read_only=True)
    patient_name = serializers.CharField(source='patient.__str__', read_only=True)

    class Meta:
        model = Appointment
        fields = '__all__'

class MedicalFileSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.CharField(source='uploaded_by.get_full_name', read_only=True)

    class Meta:
        model = MedicalFile
        fields = '__all__'

class ClinicalRecordSerializer(serializers.ModelSerializer):
    doctor_name = serializers.CharField(source='doctor.get_full_name', read_only=True)
    patient_name = serializers.CharField(source='patient.__str__', read_only=True)
    files = MedicalFileSerializer(many=True, read_only=True)

    class Meta:
        model = ClinicalRecord
        fields = '__all__'

class LabOrderSerializer(serializers.ModelSerializer):
    doctor_name = serializers.CharField(source='doctor.get_full_name', read_only=True)
    patient_name = serializers.CharField(source='patient.__str__', read_only=True)

    class Meta:
        model = LabOrder
        fields = '__all__'

class MedicationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Medication
        fields = '__all__'

class PharmacyOrderSerializer(serializers.ModelSerializer):
    doctor_name = serializers.CharField(source='doctor.get_full_name', read_only=True)
    patient_name = serializers.CharField(source='patient.__str__', read_only=True)
    medication_name = serializers.CharField(source='medication.name', read_only=True)

    class Meta:
        model = PharmacyOrder
        fields = '__all__'
