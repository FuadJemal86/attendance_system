from rest_framework import serializers
from .models import Category , Employee , Admin , AttendanceLog
import qrcode
from io import BytesIO
from django.core.files import File
from django.utils import timezone
from django.core.mail import EmailMessage
from django.contrib.auth.hashers import make_password


# add admin

class AddAdmin(serializers.ModelSerializer):
    class Meta:
        model = Admin
        fields = ['id', 'name' , 'email' , 'password' , 'image']
        extra_kwargs = {
        'password': {'write_only': True}
        }
        
    def validate_password(self, value):
        if len(value) < 6:
            raise serializers.ValidationError("Password must be at least 6 characters.")
        return value

    def create(self, validated_data):
        validated_data['password'] = make_password(validated_data['password'])
        return super().create(validated_data)
  
        
        
# add category
class AddCategory(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name']




# add employee and send email with QR code
class AddEmployee(serializers.ModelSerializer):
    class Meta:
        model = Employee
        fields = ['id', 'full_name', 'email', 'qr_code', 'category']

    def create(self, validated_data):
        # Generate attendance_id
        today = timezone.now().strftime('%Y%m%d')
        prefix = 'EAID'

        count_today = Employee.objects.filter(
            created_at__date=timezone.now().date()
        ).count() + 1

        attendance_id = f"{prefix}-{today}-{count_today:04d}"

        #  Create employee with generated attendance_id
        employee = Employee.objects.create(
            attendance_id=attendance_id,
            **validated_data
        )

        # 3. Generate QR code
        qr = qrcode.make(attendance_id)
        buffer = BytesIO()
        qr.save(buffer, format='PNG')
        file_name = f"{attendance_id}_qr.png"
        employee.qr_code.save(file_name, File(buffer), save=True)

        #  Send email
        self.send_qr_email(employee)

        return employee

    def send_qr_email(self, employee):
        subject = "Your Attendance QR Code"
        body = (
            f"Hello {employee.full_name},\n\n"
            f"Your unique attendance ID is: {employee.attendance_id}\n\n"
            f"Please find attached your QR code. Use it to check in at work.\n\n"
            f"Thank you!"
        )

        email = EmailMessage(
            subject=subject,
            body=body,
            from_email='fuad47722@gmail.com',
            to=[employee.email],
        )

        # Attach the QR code
        if employee.qr_code:
            try:
                email.attach_file(employee.qr_code.path)
                print(employee.qr_code.path)
            except Exception as e:
                print("Failed to attach QR code:", e)

        try:
            email.send()
            sent = email.send()
            print("Email sent status:", sent)
        except Exception as e:
            print("Email sending failed:", e)


# INPUT Serializer
class AttendanceScanSerializer(serializers.Serializer):
    attendance_id = serializers.CharField()

    def create(self, validated_data):
        attendance_id = validated_data['attendance_id']
        try:
            employee = Employee.objects.get(attendance_id=attendance_id)
        except Employee.DoesNotExist:
            raise serializers.ValidationError("Invalid QR code / Employee not found.")

        # Prevent duplicate attendance per day
        today = timezone.now().date()
        if AttendanceLog.objects.filter(employee=employee, scanned_at__date=today).exists():

            raise serializers.ValidationError("Attendance already logged for today.")

        return AttendanceLog.objects.create(employee=employee)
    
    
    
# OUTPUT Serializer
class AttendanceLogSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.full_name')

    class Meta:
        model = AttendanceLog
        fields = ['id', 'employee_name', 'scanned_at']
