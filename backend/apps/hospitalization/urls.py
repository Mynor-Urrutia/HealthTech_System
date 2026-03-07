"""
HealthTech Solutions — URLs: Módulo Encamamiento (M05)
Base: /api/v1/hospitalization/

Rutas Camas:
  GET/POST                        /api/v1/hospitalization/camas/
  GET/PUT/PATCH/DELETE            /api/v1/hospitalization/camas/{id}/

Rutas Encamamientos:
  GET/POST                        /api/v1/hospitalization/
  GET/PUT/PATCH/DELETE            /api/v1/hospitalization/{id}/
  POST  /api/v1/hospitalization/{id}/tratamiento/
  POST  /api/v1/hospitalization/{id}/evolucion/
  POST  /api/v1/hospitalization/{id}/egreso/
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.hospitalization.views import CamaViewSet, EncamamientoViewSet

router = DefaultRouter()
router.register('camas',  CamaViewSet,          basename='cama')
router.register('',       EncamamientoViewSet,   basename='encamamiento')

urlpatterns = [
    path('', include(router.urls)),
]
