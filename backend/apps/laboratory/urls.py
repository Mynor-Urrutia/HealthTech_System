from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import OrdenLabViewSet

router = DefaultRouter()
router.register('', OrdenLabViewSet, basename='ordenlab')

urlpatterns = [
    path('', include(router.urls)),
]
