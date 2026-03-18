#!/usr/bin/env python3
"""
Complete Logout Functionality - Backend Implementation
Extracted from server.py for clarity and debugging
"""

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from motor.motor_asyncio import AsyncIOMotorClient
import logging
from typing import Optional

# Configure detailed logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Database connection (same as in server.py)
mongo_url = "your_mongo_url_here"
client = AsyncIOMotorClient(mongo_url)
db = client['schoolerp']

async def get_session_token(request: Request) -> Optional[str]:
    """Extract session token from cookie or Authorization header"""
    logger.info("Extracting session token from request")
    
    # Try Authorization header first (for mobile apps)
    auth_header = request.headers.get("Authorization")
    logger.info(f"Authorization header present: {bool(auth_header)}")
    
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header[7:]
        logger.info(f"Token extracted from Authorization header: {token[:10]}...")
        return token
    
    # Try cookie as fallback (for web)
    session_token = request.cookies.get("session_token")
    logger.info(f"Token extracted from cookie: {bool(session_token)}")
    
    if session_token:
        logger.info(f"Cookie token: {session_token[:10]}...")
    
    return session_token

async def logout_endpoint(request: Request, response: Response):
    """Complete logout implementation with detailed logging"""
    logger.info("=" * 50)
    logger.info("🚪 LOGOUT REQUEST STARTED")
    logger.info("=" * 50)
    
    # Log request details
    logger.info(f"📡 Request method: {request.method}")
    logger.info(f"📡 Request URL: {request.url}")
    logger.info(f"📡 Client IP: {request.client.host if request.client else 'Unknown'}")
    logger.info(f"📡 User-Agent: {request.headers.get('user-agent', 'Unknown')}")
    
    # Log all headers (excluding sensitive ones)
    safe_headers = {k: v for k, v in request.headers.items() 
                   if k.lower() not in ['authorization', 'cookie']}
    logger.info(f"📡 Request headers (safe): {safe_headers}")
    
    # Log cookies
    logger.info(f"🍪 Request cookies: {dict(request.cookies)}")
    
    try:
        # Get session token from multiple sources
        session_token = None
        
        # Try Authorization header first (for mobile apps)
        auth_header = request.headers.get("Authorization")
        logger.info(f"🔑 Authorization header: {'Present' if auth_header else 'Not present'}")
        
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header[7:]
            logger.info(f"🔑 Session token from Authorization header: {session_token[:10]}...")
        
        # Try cookie as fallback (for web)
        if not session_token:
            session_token = request.cookies.get("session_token")
            logger.info(f"🔑 Session token from cookie: {'Found' if session_token else 'Not found'}")
            if session_token:
                logger.info(f"🔑 Cookie token: {session_token[:10]}...")
        
        if session_token:
            logger.info(f"🎯 Processing logout for session: {session_token[:10]}...")
            logger.info(f"🎯 Full token length: {len(session_token)} characters")
            
            # Verify session exists before deletion
            existing_session = await db.user_sessions.find_one({"session_token": session_token})
            logger.info(f"🔍 Session exists in database: {bool(existing_session)}")
            
            if existing_session:
                logger.info(f"🔍 Session user_id: {existing_session.get('user_id', 'Unknown')}")
                logger.info(f"🔍 Session created: {existing_session.get('created_at', 'Unknown')}")
                logger.info(f"🔍 Session expires: {existing_session.get('expires_at', 'Unknown')}")
            
            # Delete session from database
            logger.info("🗑️ Attempting to delete session from database...")
            result = await db.user_sessions.delete_one({"session_token": session_token})
            logger.info(f"🗑️ Database delete result: {result.__dict__}")
            
            if result.deleted_count > 0:
                logger.info(f"✅ Successfully deleted session: {session_token[:10]}...")
                logger.info(f"✅ Sessions deleted: {result.deleted_count}")
                logger.info(f"✅ Operation acknowledged: {result.acknowledged}")
            else:
                logger.warning(f"⚠️ Session not found for deletion: {session_token[:10]}...")
                logger.warning("⚠️ This might indicate the session was already expired/deleted")
        else:
            logger.warning("⚠️ Logout called without session token")
            logger.warning("⚠️ This might be a logout from an already logged-out state")
        
        # Clear cookies for web requests
        user_agent = request.headers.get("user-agent", "").lower()
        logger.info(f"🌐 User-Agent analysis: {user_agent}")
        
        is_web_browser = any(browser in user_agent for browser in ["mozilla", "chrome", "safari", "edge"])
        logger.info(f"🌐 Detected web browser: {is_web_browser}")
        
        if is_web_browser:
            logger.info("🌐 Clearing cookies for web browser")
            response.delete_cookie(key="session_token", path="/")
            response.delete_cookie(key="session_token", path="/", domain=None)
            logger.info("🌐 Cookie deletion headers set")
        
        # Prepare success response
        success_response = {"message": "Logged out successfully"}
        logger.info("✅ Logout request completed successfully")
        logger.info(f"✅ Response: {success_response}")
        
        logger.info("=" * 50)
        logger.info("🎉 LOGOUT REQUEST COMPLETED")
        logger.info("=" * 50)
        
        return success_response
    
    except Exception as e:
        logger.error("=" * 50)
        logger.error("💥 LOGOUT ERROR OCCURRED")
        logger.error("=" * 50)
        logger.error(f"💥 Error message: {str(e)}")
        logger.error(f"💥 Error type: {type(e).__name__}")
        
        # Get full traceback
        import traceback
        logger.error(f"💥 Full traceback:")
        for line in traceback.format_exc().split('\n'):
            if line.strip():
                logger.error(f"💥   {line}")
        
        # Log context information
        logger.error(f"💥 Request URL: {request.url}")
        logger.error(f"💥 Request method: {request.method}")
        logger.error(f"💥 User-Agent: {request.headers.get('user-agent', 'Unknown')}")
        
        # Always return success - client should clear local state anyway
        logger.info("🔄 Returning success despite error for client-side cleanup")
        fallback_response = {"message": "Logged out successfully"}
        logger.info(f"🔄 Fallback response: {fallback_response}")
        
        logger.info("=" * 50)
        logger.error("💥 LOGOUT ERROR HANDLED - RETURNING SUCCESS")
        logger.info("=" * 50)
        
        return fallback_response

# FastAPI router setup
api_router = APIRouter(prefix="/api")
api_router.post("/auth/logout")(logout_endpoint)

if __name__ == "__main__":
    # Test the logout functionality
    import asyncio
    from unittest.mock import Mock
    
    async def test_logout():
        print("🧪 Testing logout functionality...")
        
        # Create mock request and response
        mock_request = Mock()
        mock_request.headers = {
            "Authorization": "Bearer test_session_token_12345",
            "User-Agent": "MobileApp"
        }
        mock_request.cookies = {}
        mock_request.client = Mock()
        mock_request.client.host = "127.0.0.1"
        mock_request.url = "https://test.com/api/auth/logout"
        mock_request.method = "POST"
        
        mock_response = Mock()
        mock_response.delete_cookie = Mock()
        
        # Test the logout function
        try:
            result = await logout_endpoint(mock_request, mock_response)
            print(f"✅ Test completed. Result: {result}")
        except Exception as e:
            print(f"❌ Test failed: {e}")
    
    asyncio.run(test_logout())
