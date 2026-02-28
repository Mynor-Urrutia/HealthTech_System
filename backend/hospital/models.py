from django.db import models
from django.conf import settings

class Patient(models.Model):
    GENDER_CHOICES = (
        ('M', 'Masculino'),
        ('F', 'Femenino'),
        ('O', 'Otro'),
    )
    BLOOD_CHOICES = (
        ('A+', 'A+'), ('A-', 'A-'), ('B+', 'B+'), ('B-', 'B-'),
        ('AB+', 'AB+'), ('AB-', 'AB-'), ('O+', 'O+'), ('O-', 'O-'),
    )
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    date_of_birth = models.DateField()
    gender = models.CharField(max_length=1, choices=GENDER_CHOICES, default='M')
    blood_type = models.CharField(max_length=3, choices=BLOOD_CHOICES, blank=True, null=True)
    ssn = models.CharField(max_length=20, unique=True, help_text="Número de identidad único")
    phone = models.CharField(max_length=20)
    email = models.EmailField(blank=True, null=True)
    emergency_contact = models.CharField(max_length=100, blank=True, null=True)
    emergency_phone = models.CharField(max_length=20, blank=True, null=True)
    allergies = models.TextField(blank=True, null=True)
    address = models.TextField()
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.first_name} {self.last_name}"

class Appointment(models.Model):
    STATUS_CHOICES = (
        ('SCHEDULED', 'Agendada'),
        ('IN_PROGRESS', 'En Curso'),
        ('COMPLETED', 'Completada'),
        ('CANCELLED', 'Cancelada'),
        ('NO_SHOW', 'No Asistió'),
    )
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name='appointments')
    doctor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='doctor_appointments')
    date_time = models.DateTimeField()
    reason = models.TextField()
    notes = models.TextField(blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='SCHEDULED')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Cita: {self.patient} con {self.doctor} el {self.date_time.strftime('%Y-%m-%d %H:%M')}"

class ClinicalRecord(models.Model):
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name='clinical_records')
    doctor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    appointment = models.OneToOneField(Appointment, on_delete=models.SET_NULL, null=True, blank=True)
    diagnosis = models.TextField()
    prescription = models.TextField(blank=True, null=True)
    notes = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Historial de {self.patient} - {self.created_at.strftime('%Y-%m-%d')}"

class MedicalFile(models.Model):
    FILE_TYPES = (
        ('LAB_RESULT', 'Resultado de Laboratorio'),
        ('IMAGING', 'Imagen Médica'),
        ('PRESCRIPTION', 'Receta Médica'),
        ('REPORT', 'Informe Médico'),
        ('OTHER', 'Otro'),
    )
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name='medical_files')
    clinical_record = models.ForeignKey(ClinicalRecord, on_delete=models.SET_NULL, null=True, blank=True, related_name='files')
    file = models.FileField(upload_to='medical_files/%Y/%m/')
    file_type = models.CharField(max_length=20, choices=FILE_TYPES, default='OTHER')
    description = models.CharField(max_length=255)
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.description} - {self.patient}"

class LabOrder(models.Model):
    STATUS_CHOICES = (
        ('PENDING', 'Pendiente'),
        ('IN_PROGRESS', 'En Proceso'),
        ('COMPLETED', 'Completado'),
        ('CANCELLED', 'Cancelado'),
    )
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name='lab_orders')
    doctor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='lab_orders')
    test_name = models.CharField(max_length=200)
    description = models.TextField(blank=True, null=True)
    results = models.TextField(blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    priority = models.CharField(max_length=10, choices=(('NORMAL', 'Normal'), ('URGENT', 'Urgente')), default='NORMAL')
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(blank=True, null=True)

    def __str__(self):
        return f"{self.test_name} - {self.patient}"

class Medication(models.Model):
    name = models.CharField(max_length=200)
    generic_name = models.CharField(max_length=200, blank=True, null=True)
    category = models.CharField(max_length=100)
    stock = models.IntegerField(default=0)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    description = models.TextField(blank=True, null=True)
    requires_prescription = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} ({self.generic_name})"

class PharmacyOrder(models.Model):
    STATUS_CHOICES = (
        ('PENDING', 'Pendiente'),
        ('DISPENSED', 'Dispensada'),
        ('CANCELLED', 'Cancelada'),
    )
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name='pharmacy_orders')
    doctor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    medication = models.ForeignKey(Medication, on_delete=models.CASCADE)
    quantity = models.IntegerField(default=1)
    dosage = models.CharField(max_length=200, help_text="Ej: 500mg cada 8 horas")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.medication.name} para {self.patient}"
