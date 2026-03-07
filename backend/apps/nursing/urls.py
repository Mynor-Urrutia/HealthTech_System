from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SignoVitalViewSet, NotaEnfermeriaViewSet

router = DefaultRouter()
router.register('signos-vitales', SignoVitalViewSet, basename='signo-vital')
router.register('notas',          NotaEnfermeriaViewSet, basename='nota-enfermeria')

urlpatterns = [
    path('', include(router.urls)),
]
