from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ProductoViewSet, MovimientoViewSet

router = DefaultRouter()
router.register('productos',   ProductoViewSet,   basename='producto')
router.register('movimientos', MovimientoViewSet, basename='movimiento')

urlpatterns = [
    path('', include(router.urls)),
]
