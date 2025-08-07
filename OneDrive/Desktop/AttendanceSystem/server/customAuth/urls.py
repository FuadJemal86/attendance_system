from django.urls import path ,include
from .views import AddCategory , AddEmployee , AddAdmin , ScanQrCode


urlpatterns = [
    path('add-admin',AddAdmin.as_view() ,name='add-admin' ),
    path('add-category',AddCategory.as_view() ,name='add-category' ),
    path('add-employee',AddEmployee.as_view() ,name='add-employee' ),
    path('scan-qrCode',ScanQrCode.as_view() ,name='add-employee' ),
]