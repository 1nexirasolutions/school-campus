#!/usr/bin/env python3
"""
School ERP Backend API Testing Suite
Tests all backend APIs for the School ERP application
"""

import requests
import json
import base64
from datetime import datetime, timedelta
import sys
import os

# Configuration
BASE_URL = "https://campuslink-erp.preview.emergentagent.com/api"
TEST_SESSION_TOKEN = "test_session_principal"
TEST_USER_ID = "test_user_principal"

# Test headers
HEADERS = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {TEST_SESSION_TOKEN}"
}

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    END = '\033[0m'

def print_test_result(test_name, success, message=""):
    status = f"{Colors.GREEN}✓ PASS{Colors.END}" if success else f"{Colors.RED}✗ FAIL{Colors.END}"
    print(f"{status} {test_name}")
    if message:
        print(f"    {message}")

def test_health_check():
    """Test basic health check endpoints"""
    print(f"\n{Colors.BLUE}=== Testing Health Check Endpoints ==={Colors.END}")
    
    try:
        # Test root endpoint
        response = requests.get(f"{BASE_URL}/")
        success = response.status_code == 200
        print_test_result("GET /api/", success, f"Status: {response.status_code}")
        
        # Test health endpoint
        response = requests.get(f"{BASE_URL}/health")
        success = response.status_code == 200
        print_test_result("GET /api/health", success, f"Status: {response.status_code}")
        
        return True
    except Exception as e:
        print_test_result("Health Check", False, f"Error: {str(e)}")
        return False

def test_seed_data():
    """Test seed data creation"""
    print(f"\n{Colors.BLUE}=== Testing Seed Data API ==={Colors.END}")
    
    try:
        response = requests.post(f"{BASE_URL}/seed")
        success = response.status_code == 200
        
        if success:
            data = response.json()
            message = data.get("message", "")
        else:
            message = f"Status: {response.status_code}, Response: {response.text}"
        
        print_test_result("POST /api/seed", success, message)
        return success
    except Exception as e:
        print_test_result("POST /api/seed", False, f"Error: {str(e)}")
        return False

def test_authentication():
    """Test authentication endpoints"""
    print(f"\n{Colors.BLUE}=== Testing Authentication APIs ==={Colors.END}")
    
    try:
        # Test /auth/me endpoint
        response = requests.get(f"{BASE_URL}/auth/me", headers=HEADERS)
        success = response.status_code == 200
        
        if success:
            user_data = response.json()
            message = f"User: {user_data.get('name', 'Unknown')} ({user_data.get('role', 'Unknown')})"
        else:
            message = f"Status: {response.status_code}, Response: {response.text}"
        
        print_test_result("GET /api/auth/me", success, message)
        return success
    except Exception as e:
        print_test_result("GET /api/auth/me", False, f"Error: {str(e)}")
        return False

def test_user_management():
    """Test user management endpoints"""
    print(f"\n{Colors.BLUE}=== Testing User Management APIs ==={Colors.END}")
    
    results = []
    
    try:
        # Test get all users (principal only)
        response = requests.get(f"{BASE_URL}/users", headers=HEADERS)
        success = response.status_code == 200
        
        if success:
            users = response.json()
            message = f"Found {len(users)} users"
        else:
            message = f"Status: {response.status_code}"
        
        print_test_result("GET /api/users", success, message)
        results.append(success)
        
        # Test get teachers
        response = requests.get(f"{BASE_URL}/users/teachers", headers=HEADERS)
        success = response.status_code == 200
        
        if success:
            teachers = response.json()
            message = f"Found {len(teachers)} teachers"
        else:
            message = f"Status: {response.status_code}"
        
        print_test_result("GET /api/users/teachers", success, message)
        results.append(success)
        
        # Test get students
        response = requests.get(f"{BASE_URL}/users/students", headers=HEADERS)
        success = response.status_code == 200
        
        if success:
            students = response.json()
            message = f"Found {len(students)} students"
        else:
            message = f"Status: {response.status_code}"
        
        print_test_result("GET /api/users/students", success, message)
        results.append(success)
        
        return all(results)
    except Exception as e:
        print_test_result("User Management APIs", False, f"Error: {str(e)}")
        return False

def test_class_management():
    """Test class management endpoints"""
    print(f"\n{Colors.BLUE}=== Testing Class Management APIs ==={Colors.END}")
    
    try:
        # Test get classes
        response = requests.get(f"{BASE_URL}/classes", headers=HEADERS)
        success = response.status_code == 200
        
        if success:
            classes = response.json()
            message = f"Found {len(classes)} classes"
        else:
            message = f"Status: {response.status_code}"
        
        print_test_result("GET /api/classes", success, message)
        return success
    except Exception as e:
        print_test_result("GET /api/classes", False, f"Error: {str(e)}")
        return False

def test_attendance_management():
    """Test attendance management endpoints"""
    print(f"\n{Colors.BLUE}=== Testing Attendance Management APIs ==={Colors.END}")
    
    results = []
    
    try:
        # Test get attendance
        response = requests.get(f"{BASE_URL}/attendance", headers=HEADERS)
        success = response.status_code == 200
        
        if success:
            attendance = response.json()
            message = f"Found {len(attendance)} attendance records"
        else:
            message = f"Status: {response.status_code}"
        
        print_test_result("GET /api/attendance", success, message)
        results.append(success)
        
        # Test mark attendance
        attendance_data = [{
            "student_id": "demo_student_001",
            "student_name": "Alex Thompson",
            "class_name": "Class 12",
            "section": "A",
            "date": datetime.now().strftime("%Y-%m-%d"),
            "status": "present"
        }]
        
        response = requests.post(
            f"{BASE_URL}/attendance",
            headers=HEADERS,
            json=attendance_data
        )
        success = response.status_code == 200
        
        if success:
            created = response.json()
            message = f"Marked attendance for {len(created)} students"
        else:
            message = f"Status: {response.status_code}, Response: {response.text}"
        
        print_test_result("POST /api/attendance", success, message)
        results.append(success)
        
        return all(results)
    except Exception as e:
        print_test_result("Attendance Management APIs", False, f"Error: {str(e)}")
        return False

def test_timetable_management():
    """Test timetable management endpoints"""
    print(f"\n{Colors.BLUE}=== Testing Timetable Management APIs ==={Colors.END}")
    
    try:
        # Test get timetable
        response = requests.get(f"{BASE_URL}/timetable", headers=HEADERS)
        success = response.status_code == 200
        
        if success:
            timetable = response.json()
            message = f"Found {len(timetable)} timetable entries"
        else:
            message = f"Status: {response.status_code}"
        
        print_test_result("GET /api/timetable", success, message)
        return success
    except Exception as e:
        print_test_result("GET /api/timetable", False, f"Error: {str(e)}")
        return False

def test_assignment_management():
    """Test assignment management endpoints"""
    print(f"\n{Colors.BLUE}=== Testing Assignment Management APIs ==={Colors.END}")
    
    results = []
    
    try:
        # Test get assignments
        response = requests.get(f"{BASE_URL}/assignments", headers=HEADERS)
        success = response.status_code == 200
        
        if success:
            assignments = response.json()
            message = f"Found {len(assignments)} assignments"
        else:
            message = f"Status: {response.status_code}"
        
        print_test_result("GET /api/assignments", success, message)
        results.append(success)
        
        # Test create assignment
        assignment_data = {
            "title": "Test Assignment",
            "description": "This is a test assignment created by automated testing",
            "class_name": "Class 12",
            "section": "A",
            "subject": "Mathematics",
            "deadline": (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d"),
            "pdf_data": None
        }
        
        response = requests.post(
            f"{BASE_URL}/assignments",
            headers=HEADERS,
            json=assignment_data
        )
        success = response.status_code == 200
        
        if success:
            created = response.json()
            message = f"Created assignment: {created.get('title', 'Unknown')}"
        else:
            message = f"Status: {response.status_code}, Response: {response.text}"
        
        print_test_result("POST /api/assignments", success, message)
        results.append(success)
        
        return all(results)
    except Exception as e:
        print_test_result("Assignment Management APIs", False, f"Error: {str(e)}")
        return False

def test_assignment_submissions():
    """Test assignment submission endpoints"""
    print(f"\n{Colors.BLUE}=== Testing Assignment Submission APIs ==={Colors.END}")
    
    try:
        # Test get submissions
        response = requests.get(f"{BASE_URL}/submissions", headers=HEADERS)
        success = response.status_code == 200
        
        if success:
            submissions = response.json()
            message = f"Found {len(submissions)} submissions"
        else:
            message = f"Status: {response.status_code}"
        
        print_test_result("GET /api/submissions", success, message)
        return success
    except Exception as e:
        print_test_result("GET /api/submissions", False, f"Error: {str(e)}")
        return False

def test_leave_management():
    """Test leave application endpoints"""
    print(f"\n{Colors.BLUE}=== Testing Leave Management APIs ==={Colors.END}")
    
    try:
        # Test get leave applications
        response = requests.get(f"{BASE_URL}/leave", headers=HEADERS)
        success = response.status_code == 200
        
        if success:
            leave_apps = response.json()
            message = f"Found {len(leave_apps)} leave applications"
        else:
            message = f"Status: {response.status_code}"
        
        print_test_result("GET /api/leave", success, message)
        return success
    except Exception as e:
        print_test_result("GET /api/leave", False, f"Error: {str(e)}")
        return False

def test_notifications():
    """Test notification endpoints"""
    print(f"\n{Colors.BLUE}=== Testing Notification APIs ==={Colors.END}")
    
    results = []
    
    try:
        # Test get notifications
        response = requests.get(f"{BASE_URL}/notifications", headers=HEADERS)
        success = response.status_code == 200
        
        if success:
            notifications = response.json()
            message = f"Found {len(notifications)} notifications"
        else:
            message = f"Status: {response.status_code}"
        
        print_test_result("GET /api/notifications", success, message)
        results.append(success)
        
        # Test get unread count
        response = requests.get(f"{BASE_URL}/notifications/unread-count", headers=HEADERS)
        success = response.status_code == 200
        
        if success:
            count_data = response.json()
            message = f"Unread count: {count_data.get('unread_count', 0)}"
        else:
            message = f"Status: {response.status_code}"
        
        print_test_result("GET /api/notifications/unread-count", success, message)
        results.append(success)
        
        # Test create notification
        notification_data = {
            "title": "Test Notification",
            "message": "This is a test notification created by automated testing",
            "target_type": "all",
            "target_class": None,
            "target_section": None
        }
        
        response = requests.post(
            f"{BASE_URL}/notifications",
            headers=HEADERS,
            json=notification_data
        )
        success = response.status_code == 200
        
        if success:
            created = response.json()
            message = f"Created notification: {created.get('title', 'Unknown')}"
        else:
            message = f"Status: {response.status_code}, Response: {response.text}"
        
        print_test_result("POST /api/notifications", success, message)
        results.append(success)
        
        return all(results)
    except Exception as e:
        print_test_result("Notification APIs", False, f"Error: {str(e)}")
        return False

def setup_test_session():
    """Setup test session for authentication"""
    print(f"\n{Colors.BLUE}=== Setting Up Test Session ==={Colors.END}")
    
    try:
        # Use mongosh to create test session
        mongo_command = f'''
mongosh --eval "
use('test_database');
var visitorId = '{TEST_USER_ID}';
var sessionToken = '{TEST_SESSION_TOKEN}';
db.users.updateOne(
  {{user_id: 'demo_principal_001'}},
  {{\$set: {{user_id: 'test_user_principal'}}}},
  {{upsert: false}}
);
db.user_sessions.insertOne({{
  user_id: 'test_user_principal',
  session_token: sessionToken,
  expires_at: new Date(Date.now() + 7*24*60*60*1000),
  created_at: new Date()
}});
print('Session token: ' + sessionToken);
"
'''
        
        result = os.system(mongo_command)
        success = result == 0
        
        print_test_result("Setup Test Session", success, f"Session token: {TEST_SESSION_TOKEN}")
        return success
    except Exception as e:
        print_test_result("Setup Test Session", False, f"Error: {str(e)}")
        return False

def run_all_tests():
    """Run all backend API tests"""
    print(f"{Colors.YELLOW}School ERP Backend API Testing Suite{Colors.END}")
    print(f"Testing against: {BASE_URL}")
    print("=" * 60)
    
    # Track test results
    test_results = {}
    
    # Setup test session first
    test_results["Setup"] = setup_test_session()
    
    # Run all tests
    test_results["Health Check"] = test_health_check()
    test_results["Seed Data"] = test_seed_data()
    test_results["Authentication"] = test_authentication()
    test_results["User Management"] = test_user_management()
    test_results["Class Management"] = test_class_management()
    test_results["Attendance Management"] = test_attendance_management()
    test_results["Timetable Management"] = test_timetable_management()
    test_results["Assignment Management"] = test_assignment_management()
    test_results["Assignment Submissions"] = test_assignment_submissions()
    test_results["Leave Management"] = test_leave_management()
    test_results["Notifications"] = test_notifications()
    
    # Print summary
    print(f"\n{Colors.BLUE}=== TEST SUMMARY ==={Colors.END}")
    passed = sum(1 for result in test_results.values() if result)
    total = len(test_results)
    
    for test_name, result in test_results.items():
        status = f"{Colors.GREEN}PASS{Colors.END}" if result else f"{Colors.RED}FAIL{Colors.END}"
        print(f"{status} {test_name}")
    
    print(f"\nOverall: {passed}/{total} tests passed")
    
    if passed == total:
        print(f"{Colors.GREEN}🎉 All tests passed!{Colors.END}")
        return True
    else:
        print(f"{Colors.RED}❌ {total - passed} tests failed{Colors.END}")
        return False

if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)