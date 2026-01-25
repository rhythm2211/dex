"""
Email service for sending transactional emails
"""
import logging
from typing import Optional
import resend
from backend.app.core.config import settings

logger = logging.getLogger("dex-core")

class EmailService:
    """Service for sending emails via Resend"""
    
    def __init__(self):
        self.resend_api_key = settings.RESEND_API_KEY if hasattr(settings, 'RESEND_API_KEY') else None
        self.resend_from_email = settings.RESEND_FROM_EMAIL if hasattr(settings, 'RESEND_FROM_EMAIL') else 'onboarding@resend.dev'
        self.resend_from_name = settings.RESEND_FROM_NAME if hasattr(settings, 'RESEND_FROM_NAME') else 'DEX'
        self.frontend_url = settings.FRONTEND_URL if hasattr(settings, 'FRONTEND_URL') else 'http://localhost:3000'
        
        if self.resend_api_key:
            resend.api_key = self.resend_api_key
            self.resend_emails = resend.Emails()
            self.resend_enabled = True
            logger.info(f"Email service enabled. From: {self.resend_from_name} <{self.resend_from_email}>")
        else:
            self.resend_emails = None
            self.resend_enabled = False
            logger.warning("RESEND_API_KEY not configured. Email service will be disabled.")
    
    def send_welcome_email(self, user_email: str, user_name: Optional[str] = None) -> bool:
        """
        Send welcome email to newly registered user
        
        Args:
            user_email: User's email address
            user_name: Optional user's name
            
        Returns:
            True if email was sent successfully, False otherwise
        """
        if not self.resend_enabled:
            logger.warning(f"Email service not configured. Skipping welcome email to {user_email}")
            return False
        
        try:
            # Use first name if available, otherwise use email prefix
            display_name = user_name.split()[0] if user_name else user_email.split('@')[0]
            
            html_content = self._get_welcome_email_template(display_name)
            
            params = {
                "from": f"{self.resend_from_name} <{self.resend_from_email}>",
                "to": [user_email],
                "subject": "Welcome to DEX - Thank You for Registering!",
                "html": html_content,
            }
            
            logger.info(f"Attempting to send welcome email to {user_email}")
            logger.debug(f"Email params: from={params['from']}, to={params['to']}, subject={params['subject']}")
            
            result = self.resend_emails.send(params)
            
            # Resend API returns a dict with 'id' key on success, or raises an exception on failure
            # Handle different response formats
            email_id = None
            if isinstance(result, dict):
                email_id = result.get('id') or result.get('data', {}).get('id')
            elif hasattr(result, 'id'):
                email_id = result.id
            elif hasattr(result, 'data') and hasattr(result.data, 'id'):
                email_id = result.data.id
            
            if email_id:
                logger.info(f"Welcome email sent successfully to {user_email} (ID: {email_id})")
                return True
            else:
                logger.error(f"Failed to send welcome email to {user_email}. Unexpected response format: {result}")
                logger.error(f"Response type: {type(result)}, Response value: {result}")
                return False
                
        except Exception as e:
            logger.error(f"Error sending welcome email to {user_email}: {str(e)}", exc_info=True)
            return False
    
    def _get_welcome_email_template(self, user_name: str) -> str:
        """
        Generate HTML email template matching DEX branding
        
        Args:
            user_name: User's display name
            
        Returns:
            HTML email template string
        """
        frontend_url = self.frontend_url
        return f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to DEX</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #050505; color: #e2e8f0;">
    <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #050505;">
        <tr>
            <td align="center" style="padding: 40px 20px;">
                <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #0a0a0a; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; overflow: hidden;">
                    
                    <!-- Header with DEX Brand -->
                    <tr>
                        <td style="padding: 40px 40px 30px; text-align: center; background: linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(16, 185, 129, 0.05) 100%);">
                            <span style="font-size: 24px; font-weight: bold; letter-spacing: 0.2em; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">DEX</span>
                        </td>
                    </tr>
                    
                    <!-- Main Content -->
                    <tr>
                        <td style="padding: 40px;">
                            <h1 style="margin: 0 0 16px; font-size: 28px; font-weight: 600; color: #ffffff; line-height: 1.2;">
                                Thank You for Registering with DEX!
                            </h1>
                            
                            <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #cbd5e1;">
                                Hi {user_name},
                            </p>
                            
                            <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #cbd5e1;">
                                We're thrilled to have you join the DEX community! You've just taken the first step toward unlocking powerful insights into your codebase.
                            </p>
                            
                            <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #cbd5e1;">
                                DEX (Developer Experience) is a codebase intelligence platform that combines semantic search, graph-based dependency analysis, and AI-powered code understanding to help you navigate and understand your code like never before.
                            </p>
                            
                            <!-- Feature Highlights -->
                            <div style="margin: 32px 0; padding: 24px; background-color: rgba(99, 102, 241, 0.05); border: 1px solid rgba(99, 102, 241, 0.1); border-radius: 12px;">
                                <h2 style="margin: 0 0 20px; font-size: 20px; font-weight: 600; color: #ffffff;">What You Can Do:</h2>
                                <ul style="margin: 0; padding-left: 20px; color: #cbd5e1; line-height: 1.8;">
                                    <li style="margin-bottom: 12px;">Explore your codebase with interactive graph visualizations</li>
                                    <li style="margin-bottom: 12px;">Ask natural language questions about your code</li>
                                    <li style="margin-bottom: 12px;">Track dependencies and understand code relationships</li>
                                    <li style="margin-bottom: 12px;">Get insights into team activity and code health</li>
                                </ul>
                            </div>
                            
                            <!-- CTA Button -->
                            <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 32px 0;">
                                <tr>
                                    <td align="center" style="padding: 0;">
                                        <a href="{frontend_url}/app" 
                                           style="display: inline-block; padding: 16px 32px; background-color: #ffffff; color: #000000; text-decoration: none; border-radius: 12px; font-weight: bold; font-size: 14px; letter-spacing: 0.05em; text-transform: uppercase; box-shadow: 0 0 30px rgba(255, 255, 255, 0.15); transition: all 0.3s;">
                                            Get Started
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            
                            <p style="margin: 32px 0 0; font-size: 14px; line-height: 1.6; color: #94a3b8;">
                                If you have any questions or need assistance, feel free to reach out to our support team. We're here to help!
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="padding: 30px 40px; background-color: rgba(0, 0, 0, 0.3); border-top: 1px solid rgba(255, 255, 255, 0.1); text-align: center;">
                            <p style="margin: 0 0 12px; font-size: 14px; color: #64748b;">
                                © DEX - Developer Experience Platform
                            </p>
                            <p style="margin: 0; font-size: 12px; color: #475569;">
                                This is an automated message. Please do not reply to this email.
                            </p>
                        </td>
                    </tr>
                    
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
        """

# Global email service instance
email_service = EmailService()
