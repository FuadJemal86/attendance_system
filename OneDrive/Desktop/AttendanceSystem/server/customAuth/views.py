from rest_framework import generics
from .models import Category , Employee , Admin , AttendanceLog
from .serializer import AddCategory , AddEmployee , AddAdmin , AttendanceScanSerializer , AttendanceLogSerializer
from rest_framework.response import Response
from rest_framework import status




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


# scan the QR code
class ScanQrCode(generics.CreateAPIView):
    queryset = AttendanceLog.objects.all()
    serializer_class = AttendanceScanSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        log = serializer.save()

        # Use output serializer to return meaningful data
        output_serializer = AttendanceLogSerializer(log)
        return Response(output_serializer.data, status=status.HTTP_201_CREATED)
