from fastapi import FastAPI, APIRouter, Depends, HTTPException, Request, Response, UploadFile, File
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Any
import uuid
from datetime import datetime, timezone, timedelta
import httpx
import base64
import firebase_admin
from firebase_admin import auth as firebase_auth, credentials

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client['schoolerp']

# Create the main app
app = FastAPI()

# Initialize Firebase Admin
try:
    firebase_admin.get_app()
except ValueError:
    firebase_admin.initialize_app(options={'projectId': 'schoolcampus-dc7ae'})

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Constants
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
SESSION_EXPIRY_DAYS = 7

# Valid roles in the system
VALID_ROLES = ["principal", "teacher", "class_teacher", "student"]

# ========================
# Pydantic Models
# ========================

class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    role: str = "student"  # principal, teacher, student
    assigned_class: Optional[str] = None  # For students/teachers
    assigned_section: Optional[str] = None
    roll_number: Optional[str] = None
    admission_number: Optional[str] = None
    mobile_number: Optional[str] = None
    password: Optional[str] = None
    push_tokens: List[str] = []
    assigned_subjects: List[Any] = []
    created_at: datetime

class PushTokenUpdate(BaseModel):
    token: str

class UserUpdate(BaseModel):
    role: Optional[str] = None
    assigned_class: Optional[str] = None
    assigned_section: Optional[str] = None
    assigned_subjects: Optional[List[Any]] = None
    roll_number: Optional[str] = None
    admission_number: Optional[str] = None
    mobile_number: Optional[str] = None

class UserCreate(BaseModel):
    email: str
    name: str
    role: str = "student"  # teacher, student
    assigned_class: Optional[str] = None
    assigned_section: Optional[str] = None
    assigned_subjects: Optional[List[Any]] = []
    roll_number: Optional[str] = None
    admission_number: Optional[str] = None
    mobile_number: Optional[str] = None
    password: Optional[str] = None

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    mobile_number: Optional[str] = None
    roll_number: Optional[str] = None
    admission_number: Optional[str] = None

class SessionDataResponse(BaseModel):
    id: str
    email: str
    name: str
    picture: Optional[str] = None
    session_token: str

class AttendanceRecord(BaseModel):
    attendance_id: str
    student_id: str
    student_name: str
    class_name: str
    section: str
    date: str
    status: str  # present, absent
    marked_by: str
    created_at: datetime

class AttendanceCreate(BaseModel):
    student_id: str
    student_name: str
    class_name: str
    section: str
    date: str
    status: str

class TimetableEntry(BaseModel):
    timetable_id: str
    class_name: str
    section: str
    day: str  # monday, tuesday, etc.
    time_slot: str  # e.g., "09:00-10:00"
    duration: Optional[str] = "1 hour"
    subject: str
    teacher_id: str
    teacher_name: str
    created_by: str
    created_at: datetime

class TimetableCreate(BaseModel):
    class_name: str
    section: str
    day: str
    time_slot: str
    duration: Optional[str] = "1 hour"
    subject: str
    teacher_id: str
    teacher_name: str

class Assignment(BaseModel):
    assignment_id: str
    title: str
    description: str
    class_name: str
    section: str
    subject: str
    deadline: str
    pdf_data: Optional[str] = None  # Base64 PDF
    mentor_id: Optional[str] = None
    mentor_name: Optional[str] = None
    created_by: str
    created_by_name: str
    created_at: datetime

class AssignmentCreate(BaseModel):
    title: str
    description: str
    class_name: str
    section: str
    subject: str
    deadline: str
    pdf_data: Optional[str] = None
    mentor_id: Optional[str] = None
    mentor_name: Optional[str] = None

class AssignmentSubmission(BaseModel):
    submission_id: str
    assignment_id: str
    student_id: str
    student_name: str
    pdf_data: str  # Base64 PDF
    submitted_at: datetime
    status: str = "submitted"  # submitted, graded

class AssignmentSubmissionCreate(BaseModel):
    assignment_id: str
    pdf_data: str

class LeaveApplication(BaseModel):
    leave_id: str
    student_id: str
    student_name: str
    class_name: str
    section: str
    start_date: str
    end_date: str
    reason: str
    status: str = "pending"  # pending, approved, rejected
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime

class LeaveApplicationCreate(BaseModel):
    start_date: str
    end_date: str
    reason: str

class LeaveStatusUpdate(BaseModel):
    status: str  # approved, rejected

class Notification(BaseModel):
    notification_id: str
    title: str
    message: str
    target_type: str  # all, class, principal
    target_class: Optional[str] = None
    target_section: Optional[str] = None
    created_by: str
    created_by_name: str
    created_at: datetime
    read_by: List[str] = []

class NotificationCreate(BaseModel):
    title: str
    message: str
    target_type: str
    target_class: Optional[str] = None
    target_section: Optional[str] = None

class ClassInfo(BaseModel):
    class_id: str
    name: str
    sections: List[str]

# ========================
# Marks / Academic Performance Models
# ========================

class MarkEntry(BaseModel):
    mark_id: str
    student_id: str
    student_name: str
    class_name: str
    section: str
    subject: str
    exam_type: Optional[str] = "General"  # e.g., "Unit Test 1", "Mid Term", "Final"
    marks_obtained: float
    total_marks: float
    grade: Optional[str] = None
    remarks: Optional[str] = None
    entered_by: Optional[str] = None
    entered_by_name: Optional[str] = None
    created_at: datetime

class MarkCreate(BaseModel):
    student_id: str
    student_name: str
    class_name: str
    section: str
    subject: str
    exam_type: str
    marks_obtained: float
    total_marks: float
    grade: Optional[str] = None
    remarks: Optional[str] = None

class MarkBulkCreate(BaseModel):
    records: List[MarkCreate]

# ========================
# Fee Management Models
# ========================

class FeeStructure(BaseModel):
    fee_id: str
    class_name: str
    section: Optional[str] = None
    fee_type: str  # e.g., "Tuition", "Lab", "Transport", "Annual"
    amount: float
    installments: int = 1
    deadline: str  # YYYY-MM-DD
    academic_year: str  # e.g., "2025-2026"
    created_by: str
    created_at: datetime

class FeeStructureCreate(BaseModel):
    class_name: str
    section: Optional[str] = None
    fee_type: str
    amount: float
    installments: int = 1
    deadline: str
    academic_year: str = "2025-2026"

class FeePayment(BaseModel):
    payment_id: str
    fee_id: str
    student_id: str
    student_name: str
    class_name: str
    section: str
    amount_paid: float
    installment_number: int = 1
    mode_of_payment: str  # Cash, UPI, Card, Physical Appearance
    status: str = "submitted"  # submitted, verified, rejected
    remarks: Optional[str] = None
    collected_by: Optional[str] = None
    collected_by_name: Optional[str] = None
    payment_date: str
    created_at: datetime

class FeePaymentCreate(BaseModel):
    fee_id: str
    student_id: str
    student_name: str
    class_name: str
    section: str
    amount_paid: float
    installment_number: int = 1
    mode_of_payment: str  # Cash, UPI, Card, Physical Appearance
    remarks: Optional[str] = None
    payment_date: Optional[str] = None

# ========================
# Authentication Helpers
# ========================

async def get_session_token(request: Request) -> Optional[str]:
    """Extract session token from Authorization header or cookie"""
    # Try Authorization header first (most reliable, always fresh from AsyncStorage)
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        return auth_header[7:]
    
    # Fall back to cookie
    session_token = request.cookies.get("session_token")
    if session_token:
        return session_token
    
    return None

async def get_current_user(request: Request) -> User:
    """Get current authenticated user"""
    session_token = await get_session_token(request)
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    session = await db.user_sessions.find_one(
        {"session_token": session_token},
        {"_id": 0}
    )
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    # Check expiry with timezone handling
    expires_at = session["expires_at"]
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    
    user = await db.users.find_one(
        {"user_id": session["user_id"]},
        {"_id": 0}
    )
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    return User(**user)

async def get_optional_user(request: Request) -> Optional[User]:
    """Get current user if authenticated, None otherwise"""
    try:
        return await get_current_user(request)
    except HTTPException:
        return None

async def require_role(user: User, allowed_roles: List[str]):
    """Check if user has required role"""
    if user.role not in allowed_roles:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

# ========================
# Auth Routes
# ========================

@api_router.post("/auth/session")
async def exchange_session(request: Request, response: Response):
    """Exchange session_id for session_token - only pre-added users can login"""
    body = await request.json()
    session_id = body.get("session_id")
    
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")
    
    # Exchange with Emergent Auth
    async with httpx.AsyncClient() as client:
        auth_response = await client.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id}
        )
        
        if auth_response.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid session_id")
        
        user_data = auth_response.json()
    
    session_data = SessionDataResponse(**user_data)
    
    # IMPORTANT: Only allow login for users pre-added by principal
    existing_user = await db.users.find_one(
        {"email": session_data.email},
        {"_id": 0}
    )
    
    if not existing_user:
        logger.warning(f"Login denied for unregistered email: {session_data.email}")
        raise HTTPException(
            status_code=403,
            detail="Access denied. Your email is not registered. Please contact your principal to get added."
        )
    
    user_id = existing_user["user_id"]
    
    # Update profile picture from Google if available
    if session_data.picture and not existing_user.get("picture"):
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"picture": session_data.picture}}
        )
    
    logger.info(f"Login successful for {session_data.email} as {existing_user.get('role')}")
    
    # Create session
    expires_at = datetime.now(timezone.utc) + timedelta(days=SESSION_EXPIRY_DAYS)
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_data.session_token,
        "expires_at": expires_at,
        "created_at": datetime.now(timezone.utc)
    })
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=session_data.session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=SESSION_EXPIRY_DAYS * 24 * 60 * 60
    )
    
    # Get updated user
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    
    return {"user": user, "session_token": session_data.session_token}

class LoginRequest(BaseModel):
    email: str
    password: str

@api_router.post("/auth/login-password")
async def login_password(request: LoginRequest, response: Response):
    # Lookup by either strict email match or mobile_number match
    user = await db.users.find_one({
        "$or": [
            {"email": request.email},
            {"mobile_number": request.email}
        ]
    }, {"_id": 0})
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
        
    stored_password = user.get("password", "password123")
    if request.password != stored_password:
        raise HTTPException(status_code=401, detail="Invalid email or password")
        
    session_token = f"sess_{uuid.uuid4().hex}"
    
    session_data = {
        "session_token": session_token,
        "user_id": user["user_id"],
        "created_at": datetime.now(timezone.utc),
        "expires_at": datetime.now(timezone.utc) + timedelta(days=SESSION_EXPIRY_DAYS)
    }
    
    await db.user_sessions.insert_one(session_data)
    
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=SESSION_EXPIRY_DAYS * 24 * 60 * 60
    )
    
    return {"message": "Login successful", "user": user, "session_token": session_token}

@api_router.post("/auth/firebase-login")
async def firebase_login(request: Request, response: Response):
    """Login using Firebase ID token"""
    body = await request.json()
    id_token = body.get("id_token")
    
    if not id_token:
        raise HTTPException(status_code=400, detail="id_token required")
        
    try:
        decoded_token = firebase_auth.verify_id_token(id_token)
        email = decoded_token.get("email")
        
        if not email:
            raise HTTPException(status_code=400, detail="No email found in token")
            
        existing_user = await db.users.find_one(
            {"email": email},
            {"_id": 0}
        )
        
        if not existing_user:
            logger.warning(f"Login denied for unregistered email: {email}")
            raise HTTPException(
                status_code=403,
                detail="Access denied. Your email is not registered. Please contact your principal to get added."
            )
            
        user_id = existing_user["user_id"]
        
        # Update picture if provided
        picture = decoded_token.get("picture")
        if picture and not existing_user.get("picture"):
            await db.users.update_one(
                {"user_id": user_id},
                {"$set": {"picture": picture}}
            )
            
        # Create session
        import uuid
        session_token = f"fb_session_{uuid.uuid4().hex}"
        expires_at = datetime.now(timezone.utc) + timedelta(days=SESSION_EXPIRY_DAYS)
        await db.user_sessions.insert_one({
            "user_id": user_id,
            "session_token": session_token,
            "expires_at": expires_at,
            "created_at": datetime.now(timezone.utc)
        })
        
        response.set_cookie(
            key="session_token", value=session_token, httponly=True, secure=True, samesite="none", path="/", max_age=SESSION_EXPIRY_DAYS * 24 * 60 * 60
        )
        
        user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
        return {"user": user, "session_token": session_token}
        
    except Exception as e:
        logger.error(f"Firebase auth error: {e}")
        raise HTTPException(status_code=401, detail="Invalid Firebase token")

@api_router.post("/auth/demo-login")
async def demo_login(request: Request, response: Response):
    """Demo login - can login by email or by demo role"""
    body = await request.json()
    role = body.get("role", "student")
    email = body.get("email")
    
    user = None
    
    if email:
        # Login by email - only allow pre-added users
        user_doc = await db.users.find_one({"email": email}, {"_id": 0})
        if not user_doc:
            raise HTTPException(
                status_code=403,
                detail="Access denied. Your email is not registered. Please contact your principal."
            )
        user = user_doc
    else:
        # Fallback to demo role login
        role_to_user_id = {
            "principal": "demo_principal_001",
            "teacher": "demo_teacher_001",
            "class_teacher": "demo_classteacher_001",
            "student": "demo_student_001",
        }
        
        user_id = role_to_user_id.get(role)
        if not user_id:
            raise HTTPException(status_code=400, detail=f"Invalid role: {role}")
        
        user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
        if not user_doc:
            raise HTTPException(status_code=404, detail="Demo user not found. Please seed first (POST /api/seed)")
        user = user_doc
    
    # Create a new session token
    session_token = f"demo_session_{uuid.uuid4().hex}"
    expires_at = datetime.now(timezone.utc) + timedelta(days=SESSION_EXPIRY_DAYS)
    
    await db.user_sessions.insert_one({
        "user_id": user["user_id"],
        "session_token": session_token,
        "expires_at": expires_at,
        "created_at": datetime.now(timezone.utc)
    })
    
    # Set cookie for web
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=False,
        samesite="lax",
        path="/",
        max_age=SESSION_EXPIRY_DAYS * 24 * 60 * 60
    )
    
    logger.info(f"Demo login successful for {user.get('email')} as {user.get('role')}")
    
    return {"user": user, "session_token": session_token}

@api_router.get("/auth/me")
async def get_me(user: User = Depends(get_current_user)):
    """Get current user info"""
    return user

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    """Logout user"""
    try:
        # Get session token from multiple sources
        session_token = None
        
        # Try Authorization header first (for mobile apps)
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header[7:]
        
        # Try cookie as fallback (for web)
        if not session_token:
            session_token = request.cookies.get("session_token")
        
        if session_token:
            # Delete session from database
            result = await db.user_sessions.delete_one({"session_token": session_token})
            if result.deleted_count > 0:
                logger.info(f"Successfully deleted session: {session_token}")
            else:
                logger.warning(f"Session not found for deletion: {session_token}")
        else:
            logger.warning("Logout called without session token")
        
        # Clear cookies for web requests
        user_agent = request.headers.get("user-agent", "").lower()
        if any(browser in user_agent for browser in ["mozilla", "chrome", "safari", "edge"]):
            response.delete_cookie(key="session_token", path="/")
            response.delete_cookie(key="session_token", path="/", domain=None)
        
        return {"message": "Logged out successfully"}
    
    except Exception as e:
        logger.error(f"Logout error: {str(e)}")
        # Always return success - client should clear local state anyway
        return {"message": "Logged out successfully"}

# ========================
# Profile Routes
# ========================

@api_router.get("/profile")
async def get_profile(user: User = Depends(get_current_user)):
    """Get current user's profile"""
    return user

@api_router.put("/profile")
async def update_profile(
    update: ProfileUpdate,
    user: User = Depends(get_current_user)
):
    """Update current user's profile"""
    update_data = {k: v for k, v in update.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    await db.users.update_one(
        {"user_id": user.user_id},
        {"$set": update_data}
    )
    
    updated_user = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    return User(**updated_user)

# ========================
# User Management Routes
# ========================

@api_router.get("/users", response_model=List[User])
async def get_all_users(user: User = Depends(get_current_user)):
    """Get all users (Principal only)"""
    await require_role(user, ["principal"])
    users = await db.users.find({}, {"_id": 0}).to_list(1000)
    return [User(**u) for u in users]

@api_router.get("/users/teachers", response_model=List[User])
async def get_teachers(user: User = Depends(get_current_user)):
    """Get all teachers and class teachers"""
    await require_role(user, ["principal", "teacher", "class_teacher"])
    teachers = await db.users.find({"role": {"$in": ["teacher", "class_teacher"]}}, {"_id": 0}).to_list(1000)
    return [User(**t) for t in teachers]

@api_router.get("/users/search", response_model=List[User])
async def search_users(
    q: Optional[str] = None,
    role: Optional[str] = None,
    class_name: Optional[str] = None,
    section: Optional[str] = None,
    user: User = Depends(get_current_user)
):
    """Search users by various fields (Principal only)"""
    await require_role(user, ["principal"])
    
    query = {}
    
    if role:
        if role == "staff":
            query["role"] = {"$in": ["teacher", "class_teacher"]}
        else:
            query["role"] = role
    
    if class_name:
        query["assigned_class"] = class_name
    if section:
        query["assigned_section"] = section
    
    if q:
        search_regex = {"$regex": q, "$options": "i"}
        query["$or"] = [
            {"name": search_regex},
            {"email": search_regex},
            {"mobile_number": search_regex},
            {"admission_number": search_regex},
            {"roll_number": search_regex},
        ]
    
    users = await db.users.find(query, {"_id": 0}).to_list(1000)
    return [User(**u) for u in users]

@api_router.get("/users/students", response_model=List[User])
async def get_students(
    class_name: Optional[str] = None,
    section: Optional[str] = None,
    user: User = Depends(get_current_user)
):
    """Get students, optionally filtered by class/section"""
    await require_role(user, ["principal", "teacher", "class_teacher"])
    
    query = {"role": "student"}
    if class_name:
        query["assigned_class"] = class_name
    if section:
        query["assigned_section"] = section
    
    students = await db.users.find(query, {"_id": 0}).to_list(1000)
    return [User(**s) for s in students]

@api_router.put("/users/{user_id}")
async def update_user(
    user_id: str,
    update: UserUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update user role/class (Principal only)"""
    await require_role(current_user, ["principal"])
    
    update_data = {k: v for k, v in update.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    result = await db.users.update_one(
        {"user_id": user_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    updated_user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return User(**updated_user)

@api_router.post("/users/push-token")
async def save_push_token(
    update: PushTokenUpdate,
    current_user: User = Depends(get_current_user)
):
    """Save expo push token for current user"""
    if update.token not in getattr(current_user, 'push_tokens', []):
        await db.users.update_one(
            {"user_id": current_user.user_id},
            {"$addToSet": {"push_tokens": update.token}}
        )
    return {"message": "Push token saved"}

@api_router.post("/users")
async def create_user(
    new_user_data: UserCreate,
    current_user: User = Depends(get_current_user)
):
    """Create a new user (Principal only) with role-based required field validation"""
    await require_role(current_user, ["principal"])
    
    # Check if email already exists
    existing = await db.users.find_one({"email": new_user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="User with this email already exists")
    
    # Validate role
    if new_user_data.role not in ["teacher", "class_teacher", "student"]:
        raise HTTPException(status_code=400, detail="Role must be 'teacher', 'class_teacher', or 'student'")
    
    # Validate required fields based on role
    if new_user_data.role == "student":
        missing = []
        if not new_user_data.email: missing.append("Gmail")
        if not new_user_data.name: missing.append("Name")
        if not new_user_data.roll_number: missing.append("Roll Number")
        if not new_user_data.admission_number: missing.append("Admission Number")
        if not new_user_data.assigned_class: missing.append("Class")
        if not new_user_data.assigned_section: missing.append("Section")
        if not new_user_data.mobile_number: missing.append("Mobile Number")
        if missing:
            raise HTTPException(status_code=400, detail=f"Missing required fields for student: {', '.join(missing)}")
    
    elif new_user_data.role in ["teacher", "class_teacher"]:
        missing = []
        if not new_user_data.email: missing.append("Gmail")
        if not new_user_data.name: missing.append("Name")
        if not new_user_data.mobile_number: missing.append("Mobile Number")
        if missing:
            raise HTTPException(status_code=400, detail=f"Missing required fields for teacher: {', '.join(missing)}")
        # Class teacher must have a class+section
        if new_user_data.role == "class_teacher":
            if not new_user_data.assigned_class or not new_user_data.assigned_section:
                raise HTTPException(status_code=400, detail="Class Teacher must be assigned a Class and Section")
    
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    new_user = {
        "user_id": user_id,
        "email": new_user_data.email,
        "name": new_user_data.name,
        "picture": None,
        "role": new_user_data.role,
        "assigned_class": new_user_data.assigned_class,
        "assigned_section": new_user_data.assigned_section,
        "roll_number": new_user_data.roll_number,
        "admission_number": new_user_data.admission_number,
        "mobile_number": new_user_data.mobile_number,
        "password": new_user_data.password or "password123",
        "created_at": datetime.now(timezone.utc)
    }
    await db.users.insert_one(new_user)
    
    logger.info(f"Principal {current_user.name} created user: {new_user_data.email} as {new_user_data.role}")
    
    created_user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return User(**created_user)

@api_router.delete("/users/{user_id}")
async def delete_user(
    user_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete a user (Principal only)"""
    await require_role(current_user, ["principal"])
    
    # Prevent self-deletion
    if user_id == current_user.user_id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    # Check if user exists
    user_to_delete = await db.users.find_one({"user_id": user_id})
    if not user_to_delete:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Prevent deleting other principals
    if user_to_delete.get("role") == "principal":
        raise HTTPException(status_code=400, detail="Cannot delete a principal account")
    
    # Delete the user
    await db.users.delete_one({"user_id": user_id})
    
    # Clean up their sessions
    await db.user_sessions.delete_many({"user_id": user_id})
    
    logger.info(f"Principal {current_user.name} deleted user: {user_to_delete.get('email')} ({user_to_delete.get('role')})")
    
    return {"message": f"User {user_to_delete.get('name')} deleted successfully"}

# ========================
# Class Management Routes
# ========================

# Universal class structure: LKG, UKG, Class 1-12, each with sections A & B
DEFAULT_CLASSES = [
    {"class_id": "class_lkg", "name": "LKG", "sections": ["A", "B"]},
    {"class_id": "class_ukg", "name": "UKG", "sections": ["A", "B"]},
    {"class_id": "class_001", "name": "Class 1", "sections": ["A", "B"]},
    {"class_id": "class_002", "name": "Class 2", "sections": ["A", "B"]},
    {"class_id": "class_003", "name": "Class 3", "sections": ["A", "B"]},
    {"class_id": "class_004", "name": "Class 4", "sections": ["A", "B"]},
    {"class_id": "class_005", "name": "Class 5", "sections": ["A", "B"]},
    {"class_id": "class_006", "name": "Class 6", "sections": ["A", "B"]},
    {"class_id": "class_007", "name": "Class 7", "sections": ["A", "B"]},
    {"class_id": "class_008", "name": "Class 8", "sections": ["A", "B"]},
    {"class_id": "class_009", "name": "Class 9", "sections": ["A", "B"]},
    {"class_id": "class_010", "name": "Class 10", "sections": ["A", "B"]},
    {"class_id": "class_011", "name": "Class 11", "sections": ["A", "B"]},
    {"class_id": "class_012", "name": "Class 12", "sections": ["A", "B"]},
]

@api_router.get("/classes", response_model=List[ClassInfo])
async def get_classes(user: User = Depends(get_current_user)):
    """Get all classes - auto-seeds default classes if DB is empty"""
    classes = await db.classes.find({}, {"_id": 0}).to_list(100)
    
    if len(classes) == 0:
        logger.info(f"Database has no classes. Auto-seeding default classes...")
        for cls in DEFAULT_CLASSES:
            await db.classes.insert_one(cls)
        classes = await db.classes.find({}, {"_id": 0}).to_list(100)
    
    return [ClassInfo(**c) for c in classes]

@api_router.post("/classes/reset")
async def reset_classes(user: User = Depends(get_current_user)):
    """Reset classes to default (Principal only)"""
    await require_role(user, ["principal"])
    await db.classes.delete_many({})
    for cls in DEFAULT_CLASSES:
        await db.classes.insert_one(cls)
    classes = await db.classes.find({}, {"_id": 0}).to_list(100)
    logger.info(f"Principal {user.name} reset classes to defaults")
    return [ClassInfo(**c) for c in classes]

@api_router.post("/classes")
async def create_class(class_info: ClassInfo, user: User = Depends(get_current_user)):
    """Create a new class (Principal only)"""
    await require_role(user, ["principal"])
    
    existing = await db.classes.find_one({"name": class_info.name})
    if existing:
        raise HTTPException(status_code=400, detail="Class already exists")
    
    class_info.class_id = f"class_{uuid.uuid4().hex[:8]}"
    await db.classes.insert_one(class_info.dict())
    return class_info

@api_router.put("/classes/{class_id}")
async def update_class(class_id: str, class_info: ClassInfo, user: User = Depends(get_current_user)):
    """Update an existing class (Principal only)"""
    await require_role(user, ["principal"])
    
    existing = await db.classes.find_one({"class_id": class_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Class not found")
        
    # Make sure we don't accidentally create duplicate names (except if it's the current class)
    if existing["name"] != class_info.name:
        name_check = await db.classes.find_one({"name": class_info.name})
        if name_check:
             raise HTTPException(status_code=400, detail="Class name already exists")
    
    update_data = {
        "name": class_info.name,
        "sections": class_info.sections
    }
    
    await db.classes.update_one({"class_id": class_id}, {"$set": update_data})
    class_info.class_id = class_id
    return class_info

@api_router.delete("/classes/{class_id}")
async def delete_class(class_id: str, user: User = Depends(get_current_user)):
    """Delete a class (Principal only)"""
    await require_role(user, ["principal"])
    
    result = await db.classes.delete_one({"class_id": class_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Class not found")
        
    return {"message": "Class deleted successfully"}

# ========================
# Attendance Routes
# ========================

@api_router.post("/attendance")
async def mark_attendance(
    records: List[AttendanceCreate],
    user: User = Depends(get_current_user)
):
    """Mark attendance for students"""
    await require_role(user, ["principal", "teacher", "class_teacher"])
    
    created_records = []
    for record in records:
        # Check if attendance already exists for this student on this date
        existing = await db.attendance.find_one({
            "student_id": record.student_id,
            "date": record.date
        })
        
        if existing:
            # Update existing record
            await db.attendance.update_one(
                {"attendance_id": existing["attendance_id"]},
                {"$set": {"status": record.status, "marked_by": user.user_id}}
            )
            updated = await db.attendance.find_one(
                {"attendance_id": existing["attendance_id"]},
                {"_id": 0}
            )
            created_records.append(AttendanceRecord(**updated))
        else:
            # Create new record
            attendance_record = AttendanceRecord(
                attendance_id=f"att_{uuid.uuid4().hex[:12]}",
                student_id=record.student_id,
                student_name=record.student_name,
                class_name=record.class_name,
                section=record.section,
                date=record.date,
                status=record.status,
                marked_by=user.user_id,
                created_at=datetime.now(timezone.utc)
            )
            await db.attendance.insert_one(attendance_record.dict())
            created_records.append(attendance_record)
    
    return created_records

@api_router.get("/attendance")
async def get_attendance(
    class_name: Optional[str] = None,
    section: Optional[str] = None,
    date: Optional[str] = None,
    student_id: Optional[str] = None,
    user: User = Depends(get_current_user)
):
    """Get attendance records"""
    query = {}
    if class_name:
        query["class_name"] = class_name
    if section:
        query["section"] = section
    if date:
        query["date"] = date
    if student_id:
        query["student_id"] = student_id
    
    records = await db.attendance.find(query, {"_id": 0}).to_list(1000)
    return [AttendanceRecord(**r) for r in records]

# ========================
# Timetable Routes
# ========================

@api_router.post("/timetable")
async def create_timetable_entry(
    entry: TimetableCreate,
    user: User = Depends(get_current_user)
):
    """Create timetable entry"""
    await require_role(user, ["principal", "class_teacher"])
    
    if user.role == "class_teacher":
        if entry.class_name != user.assigned_class or entry.section != user.assigned_section:
            raise HTTPException(status_code=403, detail="Class Teachers can only edit timetables for their assigned class and section")
    
    # Check for conflicts
    existing = await db.timetable.find_one({
        "class_name": entry.class_name,
        "section": entry.section,
        "day": entry.day,
        "time_slot": entry.time_slot
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Time slot already occupied")
    
    timetable_entry = TimetableEntry(
        timetable_id=f"tt_{uuid.uuid4().hex[:12]}",
        class_name=entry.class_name,
        section=entry.section,
        day=entry.day,
        time_slot=entry.time_slot,
        subject=entry.subject,
        teacher_id=entry.teacher_id,
        teacher_name=entry.teacher_name,
        created_by=user.user_id,
        created_at=datetime.now(timezone.utc)
    )
    
    await db.timetable.insert_one(timetable_entry.dict())
    return timetable_entry

@api_router.get("/timetable")
async def get_timetable(
    class_name: Optional[str] = None,
    section: Optional[str] = None,
    day: Optional[str] = None,
    teacher_id: Optional[str] = None,
    user: User = Depends(get_current_user)
):
    """Get timetable entries"""
    query = {}
    if class_name:
        query["class_name"] = class_name
    if section:
        query["section"] = section
    if day:
        query["day"] = day
    if teacher_id:
        query["teacher_id"] = teacher_id
    
    entries = await db.timetable.find(query, {"_id": 0}).to_list(1000)
    return [TimetableEntry(**e) for e in entries]

@api_router.put("/timetable/{timetable_id}")
async def update_timetable(
    timetable_id: str,
    entry: TimetableCreate,
    user: User = Depends(get_current_user)
):
    """Update timetable entry"""
    await require_role(user, ["principal", "class_teacher"])
    
    if user.role == "class_teacher":
        if entry.class_name != user.assigned_class or entry.section != user.assigned_section:
            raise HTTPException(status_code=403, detail="Class Teachers can only edit timetables for their assigned class and section")
    
    result = await db.timetable.update_one(
        {"timetable_id": timetable_id},
        {"$set": entry.dict()}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Timetable entry not found")
    
    updated = await db.timetable.find_one({"timetable_id": timetable_id}, {"_id": 0})
    return TimetableEntry(**updated)

@api_router.delete("/timetable/{timetable_id}")
async def delete_timetable(timetable_id: str, user: User = Depends(get_current_user)):
    """Delete timetable entry"""
    await require_role(user, ["principal", "class_teacher"])
    
    existing = await db.timetable.find_one({"timetable_id": timetable_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Timetable entry not found")
        
    if user.role == "class_teacher":
        if existing["class_name"] != user.assigned_class or existing["section"] != user.assigned_section:
            raise HTTPException(status_code=403, detail="Class Teachers can only delete timetables for their assigned class and section")
            
    result = await db.timetable.delete_one({"timetable_id": timetable_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Timetable entry not found")
    
    return {"message": "Deleted successfully"}

# ========================
# Assignment Routes
# ========================

@api_router.post("/assignments")
async def create_assignment(
    assignment: AssignmentCreate,
    user: User = Depends(get_current_user)
):
    """Create assignment"""
    await require_role(user, ["principal", "teacher", "class_teacher"])
    
    if user.role == "teacher":
        if assignment.subject not in user.assigned_subjects:
            raise HTTPException(status_code=403, detail="Teachers can only add assignments for their assigned subjects")
    elif user.role == "class_teacher":
        if assignment.class_name != user.assigned_class and assignment.subject not in user.assigned_subjects:
            raise HTTPException(status_code=403, detail="Class Teachers can only add assignments for their assigned class or their specific subjects")
    
    # Validate PDF size if provided
    if assignment.pdf_data:
        pdf_size = len(base64.b64decode(assignment.pdf_data))
        if pdf_size > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail=f"PDF size exceeds {MAX_FILE_SIZE // (1024*1024)}MB limit")
    
    new_assignment = Assignment(
        assignment_id=f"assign_{uuid.uuid4().hex[:12]}",
        title=assignment.title,
        description=assignment.description,
        class_name=assignment.class_name,
        section=assignment.section,
        subject=assignment.subject,
        deadline=assignment.deadline,
        pdf_data=assignment.pdf_data,
        created_by=user.user_id,
        created_by_name=user.name,
        created_at=datetime.now(timezone.utc)
    )
    
    await db.assignments.insert_one(new_assignment.dict())
    return new_assignment

@api_router.get("/assignments")
async def get_assignments(
    class_name: Optional[str] = None,
    section: Optional[str] = None,
    user: User = Depends(get_current_user)
):
    """Get assignments"""
    query = {}
    if class_name:
        query["class_name"] = class_name
    if section:
        query["section"] = section
    
    # For students, filter by their class
    if user.role == "student" and user.assigned_class:
        query["class_name"] = user.assigned_class
        if user.assigned_section:
            query["section"] = user.assigned_section
    
    assignments = await db.assignments.find(query, {"_id": 0}).to_list(1000)
    return [Assignment(**a) for a in assignments]

@api_router.get("/assignments/{assignment_id}")
async def get_assignment(assignment_id: str, user: User = Depends(get_current_user)):
    """Get single assignment"""
    assignment = await db.assignments.find_one(
        {"assignment_id": assignment_id},
        {"_id": 0}
    )
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    return Assignment(**assignment)

@api_router.put("/assignments/{assignment_id}")
async def update_assignment(
    assignment_id: str,
    assignment: AssignmentCreate,
    user: User = Depends(get_current_user)
):
    """Update assignment"""
    await require_role(user, ["principal", "teacher", "class_teacher"])
    
    if user.role == "teacher":
        if assignment.subject not in user.assigned_subjects:
            raise HTTPException(status_code=403, detail="Teachers can only edit assignments for their assigned subjects")
    elif user.role == "class_teacher":
        if assignment.class_name != user.assigned_class and assignment.subject not in user.assigned_subjects:
            raise HTTPException(status_code=403, detail="Class Teachers can only edit assignments for their assigned class or their specific subjects")
    
    result = await db.assignments.update_one(
        {"assignment_id": assignment_id},
        {"$set": assignment.dict()}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    updated = await db.assignments.find_one({"assignment_id": assignment_id}, {"_id": 0})
    return Assignment(**updated)

@api_router.delete("/assignments/{assignment_id}")
async def delete_assignment(assignment_id: str, user: User = Depends(get_current_user)):
    """Delete assignment"""
    await require_role(user, ["principal", "teacher", "class_teacher"])
    
    existing = await db.assignments.find_one({"assignment_id": assignment_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Assignment not found")
        
    if user.role == "teacher":
        if existing["subject"] not in user.assigned_subjects:
            raise HTTPException(status_code=403, detail="Teachers can only delete assignments for their assigned subjects")
    elif user.role == "class_teacher":
        if existing["class_name"] != user.assigned_class and existing["subject"] not in user.assigned_subjects:
            raise HTTPException(status_code=403, detail="Class Teachers can only delete assignments for their assigned class or their specific subjects")
    
    result = await db.assignments.delete_one({"assignment_id": assignment_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    # Also delete submissions
    await db.assignment_submissions.delete_many({"assignment_id": assignment_id})
    
    return {"message": "Deleted successfully"}

# ========================
# Assignment Submission Routes
# ========================

@api_router.post("/submissions")
async def submit_assignment(
    submission: AssignmentSubmissionCreate,
    user: User = Depends(get_current_user)
):
    """Submit assignment (Students only)"""
    await require_role(user, ["student"])
    
    # Check if assignment exists
    assignment = await db.assignments.find_one(
        {"assignment_id": submission.assignment_id},
        {"_id": 0}
    )
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    # Check deadline
    deadline = datetime.strptime(assignment["deadline"], "%Y-%m-%d")
    if datetime.now() > deadline:
        raise HTTPException(status_code=400, detail="Submission deadline has passed")
    
    # Validate PDF size
    pdf_size = len(base64.b64decode(submission.pdf_data))
    if pdf_size > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail=f"PDF size exceeds {MAX_FILE_SIZE // (1024*1024)}MB limit")
    
    # Check if already submitted
    existing = await db.assignment_submissions.find_one({
        "assignment_id": submission.assignment_id,
        "student_id": user.user_id
    })
    
    if existing:
        # Update existing submission
        await db.assignment_submissions.update_one(
            {"submission_id": existing["submission_id"]},
            {"$set": {
                "pdf_data": submission.pdf_data,
                "submitted_at": datetime.now(timezone.utc)
            }}
        )
        updated = await db.assignment_submissions.find_one(
            {"submission_id": existing["submission_id"]},
            {"_id": 0}
        )
        return AssignmentSubmission(**updated)
    
    # Create new submission
    new_submission = AssignmentSubmission(
        submission_id=f"sub_{uuid.uuid4().hex[:12]}",
        assignment_id=submission.assignment_id,
        student_id=user.user_id,
        student_name=user.name,
        pdf_data=submission.pdf_data,
        submitted_at=datetime.now(timezone.utc)
    )
    
    await db.assignment_submissions.insert_one(new_submission.dict())
    return new_submission

@api_router.get("/submissions")
async def get_submissions(
    assignment_id: Optional[str] = None,
    user: User = Depends(get_current_user)
):
    """Get submissions"""
    query = {}
    
    if user.role == "student":
        query["student_id"] = user.user_id
    
    if assignment_id:
        query["assignment_id"] = assignment_id
    
    submissions = await db.assignment_submissions.find(query, {"_id": 0}).to_list(1000)
    return [AssignmentSubmission(**s) for s in submissions]

@api_router.get("/submissions/{submission_id}")
async def get_submission(submission_id: str, user: User = Depends(get_current_user)):
    """Get single submission"""
    submission = await db.assignment_submissions.find_one(
        {"submission_id": submission_id},
        {"_id": 0}
    )
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    return AssignmentSubmission(**submission)

# ========================
# Leave Application Routes
# ========================

@api_router.post("/leave")
async def apply_leave(
    leave: LeaveApplicationCreate,
    user: User = Depends(get_current_user)
):
    """Apply for leave (Students only)"""
    await require_role(user, ["student"])
    
    new_leave = LeaveApplication(
        leave_id=f"leave_{uuid.uuid4().hex[:12]}",
        student_id=user.user_id,
        student_name=user.name,
        class_name=user.assigned_class or "",
        section=user.assigned_section or "",
        start_date=leave.start_date,
        end_date=leave.end_date,
        reason=leave.reason,
        created_at=datetime.now(timezone.utc)
    )
    
    await db.leave_applications.insert_one(new_leave.dict())
    
    # Notify the principal about the new leave application
    try:
        class_info = f" ({user.assigned_class} - {user.assigned_section})" if user.assigned_class else ""
        leave_notification = Notification(
            notification_id=f"notif_{uuid.uuid4().hex[:12]}",
            title=f"Leave Application: {user.name}",
            message=f"{user.name}{class_info} has applied for leave from {leave.start_date} to {leave.end_date}. Reason: {leave.reason}",
            target_type="principal",
            target_class=None,
            target_section=None,
            created_by=user.user_id,
            created_by_name=user.name,
            created_at=datetime.now(timezone.utc)
        )
        await db.notifications.insert_one(leave_notification.dict())
        logger.info(f"Leave notification created for principal - student: {user.name}")
    except Exception as e:
        logger.error(f"Failed to create leave notification: {str(e)}")
    
    return new_leave

@api_router.get("/leave")
async def get_leave_applications(
    status: Optional[str] = None,
    class_name: Optional[str] = None,
    user: User = Depends(get_current_user)
):
    """Get leave applications with class teacher filtering"""
    query = {}
    
    if user.role == "student":
        # Students see only their own leaves
        query["student_id"] = user.user_id
    elif user.role == "class_teacher":
        # Class teachers see only leaves from their assigned class+section
        if user.assigned_class and user.assigned_section:
            query["class_name"] = user.assigned_class
            query["section"] = user.assigned_section
        else:
            # Class teacher without assignment sees nothing
            return []
    elif user.role == "teacher":
        # Regular teachers can filter by class if specified
        if class_name:
            query["class_name"] = class_name
    # Principal sees all leaves (no filter)
    
    if status:
        query["status"] = status
    
    applications = await db.leave_applications.find(query, {"_id": 0}).to_list(1000)
    return [LeaveApplication(**a) for a in applications]

@api_router.put("/leave/{leave_id}")
async def update_leave_status(
    leave_id: str,
    update: LeaveStatusUpdate,
    user: User = Depends(get_current_user)
):
    """Approve or reject leave (Principal/Class Teacher)"""
    await require_role(user, ["principal", "class_teacher"])
    
    # Class teachers can only approve/reject leaves from their class+section
    if user.role == "class_teacher":
        leave = await db.leave_applications.find_one({"leave_id": leave_id})
        if not leave:
            raise HTTPException(status_code=404, detail="Leave application not found")
        if leave.get("class_name") != user.assigned_class or leave.get("section") != user.assigned_section:
            raise HTTPException(status_code=403, detail="You can only approve/reject leaves from your assigned class")
    
    result = await db.leave_applications.update_one(
        {"leave_id": leave_id},
        {"$set": {
            "status": update.status,
            "reviewed_by": user.user_id,
            "reviewed_at": datetime.now(timezone.utc)
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Leave application not found")
    
    updated = await db.leave_applications.find_one({"leave_id": leave_id}, {"_id": 0})
    return LeaveApplication(**updated)

# ========================
# Notification Routes
# ========================

@api_router.post("/notifications")
async def create_notification(
    notification: NotificationCreate,
    user: User = Depends(get_current_user)
):
    """Create notification (Principal/Class Teacher only)"""
    await require_role(user, ["principal", "class_teacher"])
    
    if user.role == "class_teacher":
        if notification.target_type != "class" or notification.target_class != user.assigned_class:
            raise HTTPException(status_code=403, detail="Class Teachers can only send notifications to their assigned class")
    
    
    new_notification = Notification(
        notification_id=f"notif_{uuid.uuid4().hex[:12]}",
        title=notification.title,
        message=notification.message,
        target_type=notification.target_type,
        target_class=notification.target_class,
        target_section=notification.target_section,
        created_by=user.user_id,
        created_by_name=user.name,
        created_at=datetime.now(timezone.utc)
    )
    
    await db.notifications.insert_one(new_notification.dict())
    
    # Send Expo Push Notification
    try:
        query = {}
        if notification.target_type == "staff":
            query["role"] = {"$in": ["teacher", "class_teacher", "principal"]}
        elif notification.target_type == "class":
            query["assigned_class"] = notification.target_class
            if notification.target_section:
                query["assigned_section"] = notification.target_section
                
        # Get users matching query
        target_users = await db.users.find(query, {"push_tokens": 1}).to_list(1000)
        
        # Collect all valid push tokens
        push_tokens = []
        for u in target_users:
            tokens = u.get("push_tokens", [])
            for token in tokens:
                if token and token.startswith("ExponentPushToken"):
                    push_tokens.append(token)
                    
        # Send to Expo
        if push_tokens:
            messages = [{
                "to": token,
                "sound": "default",
                "title": notification.title,
                "body": notification.message,
                "data": {"type": "notification"}
            } for token in push_tokens]
            
            async with httpx.AsyncClient() as client:
                await client.post(
                    "https://exp.host/--/api/v2/push/send",
                    json=messages,
                    headers={
                        "Accept": "application/json",
                        "Accept-encoding": "gzip, deflate",
                        "Content-Type": "application/json"
                    }
                )
    except Exception as e:
        logger.error(f"Failed to send push notification: {e}")

    return new_notification

@api_router.get("/notifications")
async def get_notifications(user: User = Depends(get_current_user)):
    """Get notifications for user"""
    if user.role == "principal":
        # Principal gets all notifications including leave notifications
        notifications = await db.notifications.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    elif user.role in ["teacher", "class_teacher"]:
        # Teachers/class teachers get staff + all + class notifications
        query = {
            "$or": [
                {"target_type": "all"},
                {"target_type": "staff"},
                {"target_type": "class"},
            ]
        }
        notifications = await db.notifications.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    else:
        # Get notifications targeted to student's class or all students
        query = {
            "$or": [
                {"target_type": "all"},
                {
                    "target_type": "class",
                    "target_class": user.assigned_class,
                    "$or": [
                        {"target_section": user.assigned_section},
                        {"target_section": None}
                    ]
                }
            ]
        }
        notifications = await db.notifications.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    return [Notification(**n) for n in notifications]

@api_router.put("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    user: User = Depends(get_current_user)
):
    """Mark notification as read"""
    result = await db.notifications.update_one(
        {"notification_id": notification_id},
        {"$addToSet": {"read_by": user.user_id}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return {"message": "Marked as read"}

@api_router.put("/notifications/{notification_id}")
async def update_notification(
    notification_id: str,
    notification: NotificationCreate,
    user: User = Depends(get_current_user)
):
    """Edit a notification (Principal only)"""
    await require_role(user, ["principal"])
    
    update_data = notification.dict()
    result = await db.notifications.update_one(
        {"notification_id": notification_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    updated = await db.notifications.find_one({"notification_id": notification_id}, {"_id": 0})
    return Notification(**updated)

@api_router.delete("/notifications/{notification_id}")
async def delete_notification(
    notification_id: str,
    user: User = Depends(get_current_user)
):
    """Delete a notification (Principal only)"""
    await require_role(user, ["principal"])
    
    result = await db.notifications.delete_one({"notification_id": notification_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return {"message": "Notification deleted successfully"}

@api_router.get("/notifications/unread-count")
async def get_unread_count(user: User = Depends(get_current_user)):
    """Get count of unread notifications"""
    if user.role == "principal":
        # Principal sees all notifications including leave notifications
        query = {"read_by": {"$ne": user.user_id}}
    elif user.role in ["teacher", "class_teacher"]:
        # Teachers/class teachers see staff + all notifications
        query = {
            "read_by": {"$ne": user.user_id},
            "target_type": {"$in": ["all", "staff", "class"]}
        }
    else:
        query = {
            "read_by": {"$ne": user.user_id},
            "$or": [
                {"target_type": "all"},
                {
                    "target_type": "class",
                    "target_class": user.assigned_class
                }
            ]
        }
    
    count = await db.notifications.count_documents(query)
    return {"unread_count": count}

# ========================
# Marks / Academic Performance Routes
# ========================

@api_router.post("/marks")
async def add_marks(
    records: List[MarkCreate],
    user: User = Depends(get_current_user)
):
    """Add marks for students (Principal/Teacher)"""
    await require_role(user, ["principal", "teacher", "class_teacher"])
    
    for record in records:
        if user.role == "teacher":
            if record.subject not in user.assigned_subjects:
                raise HTTPException(status_code=403, detail="Teachers can only add marks for their assigned subjects")
        elif user.role == "class_teacher":
            if record.class_name != user.assigned_class and record.subject not in user.assigned_subjects:
                raise HTTPException(status_code=403, detail="Class Teachers can only add marks for their assigned class or assigned subjects")
                
    created_records = []
    for record in records:
        # Check if marks already exist for this student/subject/exam
        existing = await db.marks.find_one({
            "student_id": record.student_id,
            "subject": record.subject,
            "exam_type": record.exam_type,
            "class_name": record.class_name,
            "section": record.section
        })
        
        # Auto-calculate grade
        percentage = (record.marks_obtained / record.total_marks * 100) if record.total_marks > 0 else 0
        grade = record.grade
        if not grade:
            if percentage >= 90: grade = "A+"
            elif percentage >= 80: grade = "A"
            elif percentage >= 70: grade = "B+"
            elif percentage >= 60: grade = "B"
            elif percentage >= 50: grade = "C"
            elif percentage >= 40: grade = "D"
            else: grade = "F"
        
        if existing:
            await db.marks.update_one(
                {"mark_id": existing["mark_id"]},
                {"$set": {
                    "marks_obtained": record.marks_obtained,
                    "total_marks": record.total_marks,
                    "grade": grade,
                    "remarks": record.remarks,
                    "entered_by": user.user_id,
                    "entered_by_name": user.name
                }}
            )
            updated = await db.marks.find_one({"mark_id": existing["mark_id"]}, {"_id": 0})
            created_records.append(MarkEntry(**updated))
        else:
            mark_entry = MarkEntry(
                mark_id=f"mark_{uuid.uuid4().hex[:12]}",
                student_id=record.student_id,
                student_name=record.student_name,
                class_name=record.class_name,
                section=record.section,
                subject=record.subject,
                exam_type=record.exam_type,
                marks_obtained=record.marks_obtained,
                total_marks=record.total_marks,
                grade=grade,
                remarks=record.remarks,
                entered_by=user.user_id,
                entered_by_name=user.name,
                created_at=datetime.now(timezone.utc)
            )
            await db.marks.insert_one(mark_entry.dict())
            created_records.append(mark_entry)
    
    return created_records

@api_router.get("/marks")
async def get_marks(
    class_name: Optional[str] = None,
    section: Optional[str] = None,
    subject: Optional[str] = None,
    exam_type: Optional[str] = None,
    student_id: Optional[str] = None,
    user: User = Depends(get_current_user)
):
    """Get marks records"""
    query = {}
    
    if user.role == "student":
        query["student_id"] = user.user_id
    else:
        if class_name:
            query["class_name"] = class_name
        if section:
            query["section"] = section
        if student_id:
            query["student_id"] = student_id
    
    if subject:
        query["subject"] = subject
    if exam_type:
        query["exam_type"] = exam_type
    
    records = await db.marks.find(query, {"_id": 0}).to_list(5000)
    return [MarkEntry(**r) for r in records]

@api_router.put("/marks/{mark_id}")
async def update_mark(
    mark_id: str,
    record: MarkCreate,
    user: User = Depends(get_current_user)
):
    """Update a mark entry"""
    await require_role(user, ["principal", "teacher", "class_teacher"])
    
    existing = await db.marks.find_one({"mark_id": mark_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Mark entry not found")
        
    if user.role == "teacher":
        if existing["subject"] not in user.assigned_subjects:
            raise HTTPException(status_code=403, detail="Teachers can only edit marks for their assigned subjects")
    elif user.role == "class_teacher":
        if existing["class_name"] != user.assigned_class and existing["subject"] not in user.assigned_subjects:
            raise HTTPException(status_code=403, detail="Class Teachers can only edit marks for their assigned class or assigned subjects")
    
    percentage = (record.marks_obtained / record.total_marks * 100) if record.total_marks > 0 else 0
    grade = record.grade
    if not grade:
        if percentage >= 90: grade = "A+"
        elif percentage >= 80: grade = "A"
        elif percentage >= 70: grade = "B+"
        elif percentage >= 60: grade = "B"
        elif percentage >= 50: grade = "C"
        elif percentage >= 40: grade = "D"
        else: grade = "F"
    
    update_data = record.dict()
    update_data["grade"] = grade
    update_data["entered_by"] = user.user_id
    update_data["entered_by_name"] = user.name
    
    result = await db.marks.update_one(
        {"mark_id": mark_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Mark entry not found")
    
    updated = await db.marks.find_one({"mark_id": mark_id}, {"_id": 0})
    return MarkEntry(**updated)

@api_router.delete("/marks/{mark_id}")
async def delete_mark(
    mark_id: str,
    user: User = Depends(get_current_user)
):
    """Delete a mark entry"""
    await require_role(user, ["principal", "teacher", "class_teacher"])
    
    existing = await db.marks.find_one({"mark_id": mark_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Mark entry not found")
        
    if user.role == "teacher":
        if existing["subject"] not in user.assigned_subjects:
            raise HTTPException(status_code=403, detail="Teachers can only delete marks for their assigned subjects")
    elif user.role == "class_teacher":
        if existing["class_name"] != user.assigned_class and existing["subject"] not in user.assigned_subjects:
            raise HTTPException(status_code=403, detail="Class Teachers can only delete marks for their assigned class or assigned subjects")
    
    result = await db.marks.delete_one({"mark_id": mark_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Mark entry not found")
    
    return {"message": "Mark entry deleted successfully"}

# ========================
# Fee Management Routes
# ========================

@api_router.post("/fees/structure")
async def create_fee_structure(
    fee: FeeStructureCreate,
    user: User = Depends(get_current_user)
):
    """Create fee structure (Principal only)"""
    await require_role(user, ["principal"])
    
    new_fee = FeeStructure(
        fee_id=f"fee_{uuid.uuid4().hex[:12]}",
        class_name=fee.class_name,
        section=fee.section,
        fee_type=fee.fee_type,
        amount=fee.amount,
        installments=fee.installments,
        deadline=fee.deadline,
        academic_year=fee.academic_year,
        created_by=user.user_id,
        created_at=datetime.now(timezone.utc)
    )
    
    await db.fee_structures.insert_one(new_fee.dict())
    return new_fee

@api_router.get("/fees/structure")
async def get_fee_structures(
    class_name: Optional[str] = None,
    academic_year: Optional[str] = None,
    user: User = Depends(get_current_user)
):
    """Get fee structures"""
    query = {}
    if class_name:
        query["class_name"] = class_name
    if academic_year:
        query["academic_year"] = academic_year
    
    # Students see fees for their class
    if user.role == "student" and user.assigned_class:
        query["class_name"] = user.assigned_class
    
    fees = await db.fee_structures.find(query, {"_id": 0}).to_list(500)
    return [FeeStructure(**f) for f in fees]

@api_router.put("/fees/structure/{fee_id}")
async def update_fee_structure(
    fee_id: str,
    fee: FeeStructureCreate,
    user: User = Depends(get_current_user)
):
    """Update fee structure (Principal only)"""
    await require_role(user, ["principal"])
    
    result = await db.fee_structures.update_one(
        {"fee_id": fee_id},
        {"$set": fee.dict()}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Fee structure not found")
    
    updated = await db.fee_structures.find_one({"fee_id": fee_id}, {"_id": 0})
    return FeeStructure(**updated)

@api_router.delete("/fees/structure/{fee_id}")
async def delete_fee_structure(
    fee_id: str,
    user: User = Depends(get_current_user)
):
    """Delete fee structure (Principal only)"""
    await require_role(user, ["principal"])
    
    result = await db.fee_structures.delete_one({"fee_id": fee_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Fee structure not found")
    
    return {"message": "Fee structure deleted successfully"}

@api_router.post("/fees/payment")
async def record_fee_payment(
    payment: FeePaymentCreate,
    user: User = Depends(get_current_user)
):
    """Record a fee payment (Principal/Student)"""
    await require_role(user, ["principal", "student"])
    
    valid_modes = ["Cash", "UPI", "Card", "Physical Appearance"]
    if payment.mode_of_payment not in valid_modes:
        raise HTTPException(status_code=400, detail=f"Mode of payment must be one of: {', '.join(valid_modes)}")
    
    new_payment = FeePayment(
        payment_id=f"pay_{uuid.uuid4().hex[:12]}",
        fee_id=payment.fee_id,
        student_id=payment.student_id,
        student_name=payment.student_name,
        class_name=payment.class_name,
        section=payment.section,
        amount_paid=payment.amount_paid,
        installment_number=payment.installment_number,
        mode_of_payment=payment.mode_of_payment,
        status="submitted",
        remarks=payment.remarks,
        collected_by=user.user_id,
        collected_by_name=user.name,
        payment_date=payment.payment_date or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        created_at=datetime.now(timezone.utc)
    )
    
    await db.fee_payments.insert_one(new_payment.dict())
    return new_payment

@api_router.get("/fees/payments")
async def get_fee_payments(
    class_name: Optional[str] = None,
    section: Optional[str] = None,
    student_id: Optional[str] = None,
    fee_id: Optional[str] = None,
    status: Optional[str] = None,
    user: User = Depends(get_current_user)
):
    """Get fee payments"""
    query = {}
    
    if user.role == "student":
        query["student_id"] = user.user_id
    elif user.role == "class_teacher":
        if user.assigned_class:
            query["class_name"] = user.assigned_class
        else:
            return []
    elif user.role == "teacher":
        raise HTTPException(status_code=403, detail="Teachers do not have access to fee management")
    else:
        if class_name:
            query["class_name"] = class_name
        if section:
            query["section"] = section
        if student_id:
            query["student_id"] = student_id
    
    if fee_id:
        query["fee_id"] = fee_id
    if status:
        query["status"] = status
    
    payments = await db.fee_payments.find(query, {"_id": 0}).to_list(5000)
    return [FeePayment(**p) for p in payments]

@api_router.put("/fees/payment/{payment_id}/status")
async def update_payment_status(
    payment_id: str,
    request: Request,
    user: User = Depends(get_current_user)
):
    """Update payment status (Principal only)"""
    await require_role(user, ["principal"])
    
    body = await request.json()
    new_status = body.get("status", "submitted")
    
    if new_status not in ["submitted", "verified", "rejected"]:
        raise HTTPException(status_code=400, detail="Status must be: submitted, verified, or rejected")
    
    result = await db.fee_payments.update_one(
        {"payment_id": payment_id},
        {"$set": {"status": new_status}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    updated = await db.fee_payments.find_one({"payment_id": payment_id}, {"_id": 0})
    return FeePayment(**updated)

# ========================
# Seed Data Endpoint
# ========================

@api_router.post("/seed")
async def seed_demo_data():
    """Seed demo data for testing"""
    # Drop existing classes and re-create with the universal class structure
    await db.classes.delete_many({})
    for cls in DEFAULT_CLASSES:
        await db.classes.insert_one(cls)
    
    # Create demo users
    demo_users = [
        {
            "user_id": "demo_principal_001",
            "email": "principal@demo.school",
            "name": "Dr. Sarah Johnson",
            "picture": None,
            "role": "principal",
            "assigned_class": None,
            "assigned_section": None,
            "roll_number": None,
            "admission_number": None,
            "mobile_number": "9876543210",
            "created_at": datetime.now(timezone.utc)
        },
        {
            "user_id": "demo_teacher_001",
            "email": "teacher@demo.school",
            "name": "Mr. Robert Smith",
            "picture": None,
            "role": "teacher",
            "assigned_class": "Class 12",
            "assigned_section": "A",
            "roll_number": None,
            "admission_number": None,
            "mobile_number": "9876543211",
            "created_at": datetime.now(timezone.utc)
        },
        {
            "user_id": "demo_classteacher_001",
            "email": "classteacher@demo.school",
            "name": "Mrs. Priya Sharma",
            "picture": None,
            "role": "class_teacher",
            "assigned_class": "Class 10",
            "assigned_section": "A",
            "roll_number": None,
            "admission_number": None,
            "mobile_number": "9876543215",
            "created_at": datetime.now(timezone.utc)
        },
        {
            "user_id": "demo_teacher_002",
            "email": "teacher2@demo.school",
            "name": "Ms. Emily Davis",
            "picture": None,
            "role": "teacher",
            "assigned_class": "Class 11",
            "assigned_section": "A",
            "roll_number": None,
            "admission_number": None,
            "mobile_number": "9876543212",
            "created_at": datetime.now(timezone.utc)
        },
        {
            "user_id": "demo_student_001",
            "email": "student@demo.school",
            "name": "Alex Thompson",
            "picture": None,
            "role": "student",
            "assigned_class": "Class 12",
            "assigned_section": "A",
            "roll_number": "001",
            "admission_number": "ADM2024001",
            "mobile_number": "9876543213",
            "created_at": datetime.now(timezone.utc)
        },
        {
            "user_id": "demo_student_002",
            "email": "student2@demo.school",
            "name": "Emma Wilson",
            "picture": None,
            "role": "student",
            "assigned_class": "Class 12",
            "assigned_section": "A",
            "roll_number": "002",
            "admission_number": "ADM2024002",
            "mobile_number": "9876543214",
            "created_at": datetime.now(timezone.utc)
        },
        {
            "user_id": "demo_student_003",
            "email": "student3@demo.school",
            "name": "James Brown",
            "picture": None,
            "role": "student",
            "assigned_class": "Class 12",
            "assigned_section": "B",
            "roll_number": "001",
            "admission_number": "ADM2024003",
            "mobile_number": "9876543216",
            "created_at": datetime.now(timezone.utc)
        },
        {
            "user_id": "demo_student_004",
            "email": "student4@demo.school",
            "name": "Rahul Kumar",
            "picture": None,
            "role": "student",
            "assigned_class": "Class 10",
            "assigned_section": "A",
            "roll_number": "001",
            "admission_number": "ADM2024004",
            "mobile_number": "9876543217",
            "created_at": datetime.now(timezone.utc)
        },
    ]
    
    for user in demo_users:
        existing = await db.users.find_one({"user_id": user["user_id"]})
        if not existing:
            await db.users.insert_one(user)
    
    # Create demo timetable
    demo_timetable = [
        {
            "timetable_id": "tt_001",
            "class_name": "Class 12",
            "section": "A",
            "day": "monday",
            "time_slot": "09:00-10:00",
            "subject": "Mathematics",
            "teacher_id": "demo_teacher_001",
            "teacher_name": "Mr. Robert Smith",
            "created_by": "demo_principal_001",
            "created_at": datetime.now(timezone.utc)
        },
        {
            "timetable_id": "tt_002",
            "class_name": "Class 12",
            "section": "A",
            "day": "monday",
            "time_slot": "10:00-11:00",
            "subject": "Physics",
            "teacher_id": "demo_teacher_002",
            "teacher_name": "Ms. Emily Davis",
            "created_by": "demo_principal_001",
            "created_at": datetime.now(timezone.utc)
        },
        {
            "timetable_id": "tt_003",
            "class_name": "Class 12",
            "section": "A",
            "day": "tuesday",
            "time_slot": "09:00-10:00",
            "subject": "English",
            "teacher_id": "demo_teacher_001",
            "teacher_name": "Mr. Robert Smith",
            "created_by": "demo_principal_001",
            "created_at": datetime.now(timezone.utc)
        },
    ]
    
    for tt in demo_timetable:
        existing = await db.timetable.find_one({"timetable_id": tt["timetable_id"]})
        if not existing:
            await db.timetable.insert_one(tt)
    
    # Create demo notifications
    demo_notifications = [
        {
            "notification_id": "notif_001",
            "title": "Welcome to School ERP",
            "message": "Welcome to our new School ERP system. Please explore all the features!",
            "target_type": "all",
            "target_class": None,
            "target_section": None,
            "created_by": "demo_principal_001",
            "created_by_name": "Dr. Sarah Johnson",
            "created_at": datetime.now(timezone.utc),
            "read_by": []
        },
        {
            "notification_id": "notif_002",
            "title": "Class 12 Test Schedule",
            "message": "Mid-term tests will begin from next Monday. Please prepare accordingly.",
            "target_type": "class",
            "target_class": "Class 12",
            "target_section": None,
            "created_by": "demo_teacher_001",
            "created_by_name": "Mr. Robert Smith",
            "created_at": datetime.now(timezone.utc),
            "read_by": []
        },
    ]
    
    for notif in demo_notifications:
        existing = await db.notifications.find_one({"notification_id": notif["notification_id"]})
        if not existing:
            await db.notifications.insert_one(notif)
    
    # Create demo assignments
    demo_assignments = [
        {
            "assignment_id": "assign_001",
            "title": "Mathematics Chapter 5 Problems",
            "description": "Solve all exercises from Chapter 5 - Quadratic Equations",
            "class_name": "Class 12",
            "section": "A",
            "subject": "Mathematics",
            "deadline": (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d"),
            "pdf_data": None,
            "created_by": "demo_teacher_001",
            "created_by_name": "Mr. Robert Smith",
            "created_at": datetime.now(timezone.utc)
        },
        {
            "assignment_id": "assign_002",
            "title": "Physics Lab Report",
            "description": "Submit your lab report on the pendulum experiment",
            "class_name": "Class 12",
            "section": "A",
            "subject": "Physics",
            "deadline": (datetime.now() + timedelta(days=5)).strftime("%Y-%m-%d"),
            "pdf_data": None,
            "created_by": "demo_teacher_002",
            "created_by_name": "Ms. Emily Davis",
            "created_at": datetime.now(timezone.utc)
        },
    ]
    
    for assign in demo_assignments:
        existing = await db.assignments.find_one({"assignment_id": assign["assignment_id"]})
        if not existing:
            await db.assignments.insert_one(assign)
    
    return {"message": "Demo data seeded successfully"}

# ========================
# Health Check
# ========================

@api_router.get("/")
async def root():
    return {"message": "School ERP API is running"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

@app.get("/")
async def root_redirect():
    return {"message": "School ERP API", "docs": "/docs", "api": "/api/"}

# ========================
# DB Browser API (for development)
# ========================
@api_router.get("/db/collections")
async def list_collections():
    """List all collections and their document counts"""
    collections = await db.list_collection_names()
    result = []
    for name in sorted(collections):
        count = await db[name].count_documents({})
        result.append({"name": name, "count": count})
    return {"collections": result}

@api_router.get("/db/collections/{collection_name}")
async def get_collection_data(collection_name: str, limit: int = 50, skip: int = 0):
    """Get documents from a collection"""
    collections = await db.list_collection_names()
    if collection_name not in collections:
        raise HTTPException(status_code=404, detail=f"Collection '{collection_name}' not found")
    
    total = await db[collection_name].count_documents({})
    cursor = db[collection_name].find({}, {"_id": 0}).skip(skip).limit(limit).sort("created_at", -1)
    docs = await cursor.to_list(length=limit)
    
    # Convert datetime objects to strings
    import json
    from bson import json_util
    docs = json.loads(json_util.dumps(docs))
    
    return {"collection": collection_name, "total": total, "skip": skip, "limit": limit, "documents": docs}

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
