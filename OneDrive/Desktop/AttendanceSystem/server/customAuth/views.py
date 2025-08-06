from rest_framework import generics
from .models import Category , Employee
from .serializer import AddCategory , AddEmployee

# Create your views here.

class AddCategory(generics.CreateAPIView):
    queryset = Category.objects.all()
    serializer_class = AddCategory


# add employee
class AddEmployee(generics.CreateAPIView):
    queryset = Employee.objects.all()
    serializer_class = AddEmployee