import os
import google.generativeai as genai
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure Gemini API
api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    print("Warning: GEMINI_API_KEY environment variable not set.")

genai.configure(api_key=api_key)

class FinancialChatbot:
    def __init__(self):
        self.model = genai.GenerativeModel("gemini-3-flash-preview")
        self.chat = None

    def start_new_session(self, expenses):
        """Initializes a new chat session with the current expense context."""
        system_prompt = f"""
        You are an AI Financial Advisor. You are chatting with a user about their personal expenses.
        
        Current Expenses Data:
        {expenses}
        
        Your Goal:
        1. Answer questions about their spending.
        2. Provide actionable money-saving advice.
        3. Be friendly, motivating, and professional.
        4. Remember the context of the conversation.
        
        Keep responses concise (under 2-3 sentences) unless asked for a detailed breakdown.
        """
        self.chat = self.model.start_chat(history=[
            {"role": "user", "parts": [system_prompt]},
            {"role": "model", "parts": ["Understood. I am ready to act as your Financial Advisor based on this data."]}
        ])
        return "Hello! I've analyzed your expenses. How can I help you save money today?"

    def send_message(self, user_input):
        if not self.chat:
            return "Please initialize the chat first."
        try:
            response = self.chat.send_message(user_input)
            return response.text
        except Exception as e:
            return f"I encountered an error: {str(e)}"

# Global instance
chatbot = FinancialChatbot()
