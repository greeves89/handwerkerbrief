from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class FeedbackCreate(BaseModel):
    type: str = "general"  # bug / feature / general
    title: str
    message: str


class FeedbackUpdate(BaseModel):
    status: Optional[str] = None
    admin_response: Optional[str] = None


class FeedbackResponse(BaseModel):
    id: int
    user_id: int
    type: str
    title: str
    message: str
    status: str
    admin_response: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
