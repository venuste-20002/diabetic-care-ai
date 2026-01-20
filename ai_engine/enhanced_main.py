from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import joblib
from pathlib import Path
import pandas as pd
import numpy as np
from typing import Dict, List, Optional
import re
from datetime import datetime
import sys

# Add the current directory to path to import our enhanced NLP
sys.path.append(str(Path(__file__).parent))

# Import our enhanced NLP analyzer
try:
    from enhanced_nlp_fixed import enhanced_analyzer
    ENHANCED_NLP_AVAILABLE = True
except ImportError:
    ENHANCED_NLP_AVAILABLE = False
    print("Enhanced NLP not available, using basic analysis")

# Load trained model
model_path = Path(__file__).resolve().parent / "diabetes_model.pkl"
model_components = joblib.load(model_path)
model = model_components["best_model"]
scaler = model_components["scaler"]

# Define request schemas
class DiabetesInput(BaseModel):
    age: float
    bmi: float
    weight: float
    height: float
    systolic_bp: float
    family_history: int
    physical_activity: int
    diet_quality: float
    location: int
    smoking: int

class ChatMessage(BaseModel):
    message: str
    user_id: Optional[str] = None
    context: Optional[Dict] = None

class AIResponse(BaseModel):
    response: str
    confidence: float
    category: str
    suggestions: List[str]
    related_data: Optional[Dict] = None
    enhanced_analysis: Optional[Dict] = None

# Basic AI analyzer (existing)
class DiabetesAIAnalyzer:
    def __init__(self):
        self.keywords = {
            'blood_sugar': ['glucose', 'sugar', 'bg', 'reading', 'level', 'high', 'low', 'normal'],
            'medication': ['medication', 'medicine', 'pill', 'insulin', 'metformin', 'dose', 'prescription'],
            'diet': ['food', 'eat', 'meal', 'diet', 'carb', 'protein', 'calories', 'nutrition'],
            'exercise': ['exercise', 'workout', 'walk', 'run', 'gym', 'activity', 'fitness'],
            'symptoms': ['symptom', 'feeling', 'tired', 'thirsty', 'blurry', 'vision', 'headache'],
            'weight': ['weight', 'bmi', 'lose', 'gain', 'pounds', 'kilos', 'obesity'],
            'stress': ['stress', 'anxiety', 'sleep', 'mood', 'depression', 'mental'],
            'monitoring': ['monitor', 'track', 'check', 'test', 'device', 'glucometer']
        }
        
        self.advice_templates = {
            'blood_sugar_high': [
                "Your blood sugar appears to be high. Consider checking with your healthcare provider.",
                "High readings can be managed with proper medication, diet, and exercise adjustments.",
                "Stay hydrated and monitor your levels closely throughout the day."
            ],
            'blood_sugar_low': [
                "Low blood sugar can be dangerous. Have a quick-acting carbohydrate like glucose tablets or juice.",
                "Check your levels again in 15 minutes and ensure you're feeling better.",
                "Consider what might have caused this low - missed meal, extra exercise, or medication timing."
            ],
            'medication_adherence': [
                "Taking medications as prescribed is crucial for diabetes management.",
                "Set reminders on your phone or use a pill organizer to stay consistent.",
                "If you're experiencing side effects, discuss alternatives with your doctor."
            ],
            'diet_guidance': [
                "Focus on balanced meals with vegetables, lean proteins, and controlled carbohydrates.",
                "Consider working with a registered dietitian for personalized meal planning.",
                "Track your food intake to understand how different foods affect your blood sugar."
            ],
            'exercise_recommendations': [
                "Regular physical activity helps improve insulin sensitivity and blood sugar control.",
                "Aim for 150 minutes of moderate exercise per week, but check blood sugar before and after.",
                "Start with activities you enjoy - walking, swimming, or cycling are great options."
            ]
        }

    def analyze_message(self, message: str, user_context: Dict = None) -> Dict:
        message_lower = message.lower()
        detected_categories = []
        for category, keywords in self.keywords.items():
            if any(keyword in message_lower for keyword in keywords):
                detected_categories.append(category)
        numbers = re.findall(r'\d+(?:\.\d+)?', message)
        readings = [float(n) for n in numbers if 20 <= float(n) <= 600]
        positive_words = ['good', 'great', 'better', 'improved', 'excellent', 'perfect']
        negative_words = ['bad', 'worst', 'terrible', 'awful', 'poor', 'worse']
        sentiment = 'neutral'
        if any(word in message_lower for word in positive_words):
            sentiment = 'positive'
        elif any(word in message_lower for word in negative_words):
            sentiment = 'negative'
        return {
            'categories': detected_categories,
            'readings': readings,
            'sentiment': sentiment,
            'urgency': self._calculate_urgency(message_lower, readings)
        }

    def _calculate_urgency(self, message: str, readings: List[float]) -> str:
        urgent_keywords = ['emergency', 'urgent', 'help', 'severe', 'critical', 'danger']
        if any(keyword in message for keyword in urgent_keywords):
            return 'high'
        if readings:
            if any(r > 300 or r < 50 for r in readings):
                return 'high'
            elif any(r > 250 or r < 70 for r in readings):
                return 'medium'
        return 'low'

    def generate_response(self, analysis: Dict, user_context: Dict = None) -> AIResponse:
        if not analysis['categories']:
            return AIResponse(
                response="I'm here to help with your diabetes management. You can ask me about blood sugar, medications, diet, exercise, or any diabetes-related concerns.",
                confidence=0.8,
                category="general",
                suggestions=["Check your latest blood sugar readings", "Review your medication schedule", "Plan your next meal"]
            )
        response_text = ""
        suggestions = []
        category = analysis['categories'][0] if analysis['categories'] else "general"
        if 'blood_sugar' in analysis['categories'] and analysis['readings']:
            reading = analysis['readings'][0]
            if reading > 180:
                response_text = self.advice_templates['blood_sugar_high'][0]
                suggestions.extend([
                    "Check your blood sugar again in 2 hours",
                    "Review what you ate recently",
                    "Consider if you missed any medication"
                ])
            elif reading < 70:
                response_text = self.advice_templates['blood_sugar_low'][0]
                suggestions.extend([
                    "Have 15g of fast-acting carbs",
                    "Recheck in 15 minutes",
                    "Inform a family member or friend"
                ])
            else:
                response_text = "Your blood sugar reading looks good! Keep up the great work with your management."
                suggestions.extend([
                    "Continue your current routine",
                    "Stay consistent with meals and medication",
                    "Keep monitoring regularly"
                ])
        elif 'medication' in analysis['categories']:
            response_text = self.advice_templates['medication_adherence'][0]
            suggestions.extend([
                "Set phone reminders for medication times",
                "Use a pill organizer",
                "Track any side effects to discuss with your doctor"
            ])
        elif 'diet' in analysis['categories']:
            response_text = self.advice_templates['diet_guidance'][0]
            suggestions.extend([
                "Plan your meals for the week",
                "Keep a food diary",
                "Learn to read nutrition labels"
            ])
        elif 'exercise' in analysis['categories']:
            response_text = self.advice_templates['exercise_recommendations'][0]
            suggestions.extend([
                "Start with 10-minute walks",
                "Find an exercise buddy",
                "Track your activity levels"
            ])
        if user_context:
            if user_context.get('recent_readings'):
                suggestions.append("Review your recent blood sugar trends")
            if user_context.get('missed_tasks'):
                suggestions.append("Focus on completing your daily diabetes tasks")
        return AIResponse(
            response=response_text,
            confidence=0.85,
            category=category,
            suggestions=suggestions,
            related_data=analysis
        )

# Initialize AI analyzer
ai_analyzer = DiabetesAIAnalyzer()

# FastAPI app
app = FastAPI(title="GlucoGuard AI Chat System", version="3.0.0")

@app.post("/predict-risk")
def predict_risk(data: DiabetesInput):
    try:
        patient_data = pd.DataFrame([data.dict()])
        patient_data['bmi_category'] = pd.cut(patient_data['bmi'],
                                             bins=[0, 18.5, 25, 30, 100],
                                             labels=[0, 1, 2, 3])
        patient_data['bmi_category'] = patient_data['bmi_category'].cat.add_categories(-1).fillna(-1).astype(int)
        patient_data['age_group'] = pd.cut(patient_data['age'],
                                          bins=[0, 30, 45, 60, 100],
                                          labels=[0, 1, 2, 3])
        patient_data['age_group'] = patient_data['age_group'].cat.add_categories(-1).fillna(-1).astype(int)
        feature_columns = ['age', 'bmi', 'weight', 'height', 'systolic_bp',
                          'family_history', 'physical_activity', 'diet_quality',
                          'location', 'smoking', 'bmi_category', 'age_group']
        X_patient = patient_data[feature_columns]
        scaled_features = scaler.transform(X_patient)
        prediction = model.predict(scaled_features)[0]
        probability = model.predict_proba(scaled_features)[0]
        risk_categories = ['Non-diabetic', 'Low Risk', 'Moderate Risk', 'High Risk', 'Critical Risk']
        return {
            "risk_category": risk_categories[prediction],
            "risk_level": int(prediction),
            "probabilities": {risk_categories[i]: float(prob) for i, prob in enumerate(probability)},
            "recommendations": [
                "Monitor blood sugar regularly",
                "Follow prescribed medication schedule",
                "Maintain healthy diet and exercise routine",
                "Schedule regular check-ups with healthcare provider"
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/ai-chat")
async def ai_chat(chat_message: ChatMessage):
    try:
        if ENHANCED_NLP_AVAILABLE and enhanced_analyzer:
            enhanced_analysis = enhanced_analyzer.analyze(chat_message.message, chat_message.context)
            response_data = {
                "response": f"Based on your message, I detected: {enhanced_analysis.intent} intent with {enhanced_analysis.urgency_level} urgency. {enhanced_analysis.recommendations[0] if enhanced_analysis.recommendations else 'Please provide more details.'}",
                "confidence": enhanced_analysis.confidence,
                "category": enhanced_analysis.intent,
                "suggestions": enhanced_analysis.recommendations[:3],
                "enhanced_analysis": {
                    "sentiment": enhanced_analysis.sentiment_score,
                    "emotion": enhanced_analysis.emotion,
                    "entities": enhanced_analysis.entities,
                    "keywords": enhanced_analysis.keywords,
                    "diabetes_insights": enhanced_analysis.diabetes_specific_insights
                }
            }
            return response_data
        else:
            analysis = ai_analyzer.analyze_message(chat_message.message, chat_message.context)
            response = ai_analyzer.generate_response(analysis, chat_message.context)
            return response.dict()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/analyze-text")
async def analyze_text(chat_message: ChatMessage):
    try:
        if ENHANCED_NLP_AVAILABLE and enhanced_analyzer:
            enhanced_analysis = enhanced_analyzer.analyze(chat_message.message, chat_message.context)
            return {
                "analysis": {
                    "intent": enhanced_analysis.intent,
                    "sentiment": enhanced_analysis.sentiment_score,
                    "emotion": enhanced_analysis.emotion,
                    "urgency": enhanced_analysis.urgency_level,
                    "entities": enhanced_analysis.entities,
                    "keywords": enhanced_analysis.keywords,
                    "diabetes_insights": enhanced_analysis.diabetes_specific_insights
                },
                "insights": {
                    "primary_concern": enhanced_analysis.intent,
                    "urgency_level": enhanced_analysis.urgency_level,
                    "sentiment": enhanced_analysis.sentiment_score,
                    "action_needed": enhanced_analysis.urgency_level in ['high', 'critical']
                }
            }
        else:
            analysis = ai_analyzer.analyze_message(chat_message.message, chat_message.context)
            return {
                "analysis": analysis,
                "insights": {
                    "primary_concern": analysis['categories'][0] if analysis['categories'] else "general",
                    "urgency_level": analysis['urgency'],
                    "sentiment": analysis['sentiment'],
                    "action_needed": analysis['urgency'] in ['high', 'medium']
                }
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "enhanced_nlp_available": ENHANCED_NLP_AVAILABLE
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
