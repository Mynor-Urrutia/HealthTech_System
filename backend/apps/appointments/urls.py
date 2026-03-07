"""
HealthTech Solutions — URLs: Módulo Citas (M03)
Base: /api/v1/appointments/

Rutas generadas por DefaultRouter:
  GET/POST                        /api/v1/appointments/
  GET/PUT/PATCH/DELETE            /api/v1/appointments/{id}/

Acciones de máquina de estados:
  POST  /api/v1/appointments/{id}/confirmar/
  POST  /api/v1/appointments/{id}/cancelar/
  POST  /api/v1/appointments/{id}/completar/
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.appointments.views import CitaViewSet

router = DefaultRouter()
router.register('', CitaViewSet, basename='cita')

urlpatterns = [
    path('', include(router.urls)),
]
