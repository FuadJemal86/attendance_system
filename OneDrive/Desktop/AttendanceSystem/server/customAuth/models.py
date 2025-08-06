from django.db import models
from django.utils import timezone


class Admin(models.Model):
    name = models.CharField(max_length=50)
    email = models.EmailField(unique=True)
    password = models.CharField(max_length=128)
    image = models.ImageField(upload_to='images/', blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name


class Category(models.Model):
    name = models.CharField(max_length=50)

    def __str__(self):
        return self.name


class Employee(models.Model):
    full_name = models.CharField(max_length=100)
    attendance_id = models.CharField(max_length=50, unique=True)
    email = models.EmailField(unique=True)
    category = models.ForeignKey(Category, on_delete=models.CASCADE, related_name="employees")
    qr_code = models.ImageField(upload_to='qr_codes/', blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.full_name} - {self.attendance_id}"


class Attendance(models.Model):
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="attendances")
    timestamp = models.DateTimeField(default=timezone.now)  # One field is enough for attendance log

    def __str__(self):
        return f"{self.employee.full_name} @ {self.timestamp.strftime('%Y-%m-%d %H:%M')}"
