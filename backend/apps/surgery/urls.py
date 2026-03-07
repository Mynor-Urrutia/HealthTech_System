from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import CirugiaViewSet

router = DefaultRouter()
router.register('', CirugiaViewSet, basename='cirugia')

urlpatterns = [
    path('', include(router.urls)),
]
