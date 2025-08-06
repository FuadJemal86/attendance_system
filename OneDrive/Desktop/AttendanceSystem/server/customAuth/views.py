from rest_framework import generics
from .models import Category , Employee , Admin
from .serializer import AddCategory , AddEmployee , AddAdmin

# Create your views here.


# add admin
class AddAdmin(generics.CreateAPIView):
    queryset = Admin.objects.all()
    serializer_class = AddAdmin
    
#add category 
class AddCategory(generics.CreateAPIView):
    queryset = Category.objects.all()
    serializer_class = AddCategory


# add employee
class AddEmployee(generics.CreateAPIView):
    queryset = Employee.objects.all()
    serializer_class = AddEmployee