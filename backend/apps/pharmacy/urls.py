from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import MedicamentoViewSet, DispensacionViewSet

router = DefaultRouter()
router.register('medicamentos',  MedicamentoViewSet,  basename='medicamento')
router.register('dispensaciones', DispensacionViewSet, basename='dispensacion')

urlpatterns = [
    path('', include(router.urls)),
]
