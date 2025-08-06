from django.urls import path ,include
from .views import AddCategory , AddEmployee


urlpatterns = [
    path('add-category',AddCategory.as_view() ,name='add-category' ),
    path('add-employee',AddEmployee.as_view() ,name='add-employee' ),
]