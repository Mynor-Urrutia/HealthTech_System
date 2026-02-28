from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    PatientViewSet, AppointmentViewSet, ClinicalRecordViewSet,
    MedicalFileViewSet, LabOrderViewSet, MedicationViewSet, PharmacyOrderViewSet
)

router = DefaultRouter()
router.register(r'patients', PatientViewSet)
router.register(r'appointments', AppointmentViewSet)
router.register(r'clinical-records', ClinicalRecordViewSet)
router.register(r'medical-files', MedicalFileViewSet)
router.register(r'lab-orders', LabOrderViewSet)
router.register(r'medications', MedicationViewSet)
router.register(r'pharmacy-orders', PharmacyOrderViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
