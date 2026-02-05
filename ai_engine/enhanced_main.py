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

class MealPlanRequest(BaseModel):
    calories_target: Optional[int] = 2000
    dietary_restrictions: Optional[List[str]] = []
    meal_type: Optional[str] = "daily"  
    diabetes_type: Optional[str] = "type2"  

class ExercisePlanRequest(BaseModel):
    fitness_level: str = "beginner"  
    duration_week: int = 150  
    preferences: Optional[List[str]] = []  
    health_conditions: Optional[List[str]] = []

class MedicationReminder(BaseModel):
    medication_name: str
    dosage: str
    frequency: str 
    times: List[str] 
    start_date: str
    end_date: Optional[str] = None

class SymptomLog(BaseModel):
    symptom_type: str
    severity: int 
    description: Optional[str] = None
    timestamp: Optional[str] = None
    glucose_reading: Optional[float] = None

class EducationalContent(BaseModel):
    topic: str
    content_type: str = "article" 
    difficulty: str = "beginner" 

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

@app.post("/meal-plan")
async def generate_meal_plan(request: MealPlanRequest):
    """Generate personalized meal plan using AI"""
    try:
      
        base_calories = request.calories_target or 2000
        if request.diabetes_type == "type1":
            base_calories = int(base_calories * 1.1) 
        elif request.diabetes_type == "gestational":
            base_calories = int(base_calories * 0.9)  
        meals = {
            "breakfast": {
                "calories": int(base_calories * 0.25),
                "carbs": "30-45g",
                "protein": "15-20g",
                "suggestions": [
                    "Oatmeal with berries and nuts",
                    "Greek yogurt with chia seeds",
                    "Whole grain toast with avocado"
                ]
            },
            "lunch": {
                "calories": int(base_calories * 0.35),
                "carbs": "45-60g",
                "protein": "25-30g",
                "suggestions": [
                    "Grilled chicken salad with quinoa",
                    "Turkey wrap with vegetables",
                    "Lentil soup with whole grain bread"
                ]
            },
            "dinner": {
                "calories": int(base_calories * 0.30),
                "carbs": "40-55g",
                "protein": "25-30g",
                "suggestions": [
                    "Baked salmon with sweet potato",
                    "Stir-fried tofu with brown rice",
                    "Lean beef with roasted vegetables"
                ]
            },
            "snacks": {
                "calories": int(base_calories * 0.10),
                "carbs": "15-20g",
                "protein": "5-10g",
                "suggestions": [
                    "Apple with almond butter",
                    "Carrot sticks with hummus",
                    "Handful of nuts"
                ]
            }
        }

        # Apply dietary restrictions
        if request.dietary_restrictions:
            for restriction in request.dietary_restrictions:
                if restriction.lower() == "vegetarian":
                    # Modify suggestions to be vegetarian
                    meals["lunch"]["suggestions"] = [
                        "Quinoa salad with chickpeas",
                        "Vegetable stir-fry with tofu",
                        "Lentil curry with brown rice"
                    ]
                    meals["dinner"]["suggestions"] = [
                        "Vegetable curry with chickpeas",
                        "Stuffed bell peppers",
                        "Eggplant parmesan"
                    ]

        return {
            "meal_plan": meals,
            "total_calories": sum(meal["calories"] for meal in meals.values()),
            "diabetes_type": request.diabetes_type,
            "dietary_restrictions": request.dietary_restrictions,
            "ai_generated": True,
            "tips": [
                "Monitor blood sugar 2 hours after meals",
                "Stay hydrated throughout the day",
                "Include fiber-rich foods for better blood sugar control"
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/exercise-plan")
async def generate_exercise_plan(request: ExercisePlanRequest):
    """Generate AI-powered personalized exercise plan"""
    try:
        # AI logic for exercise planning based on fitness level
        plans = {
            "beginner": {
                "weekly_structure": {
                    "cardio": "20-30 minutes, 3x/week",
                    "strength": "2x/week, bodyweight exercises",
                    "flexibility": "10 minutes daily"
                },
                "exercises": {
                    "cardio": [
                        {"name": "Walking", "duration": "20-30 min", "intensity": "moderate"},
                        {"name": "Swimming", "duration": "20 min", "intensity": "light"},
                        {"name": "Cycling", "duration": "20 min", "intensity": "moderate"}
                    ],
                    "strength": [
                        {"name": "Wall push-ups", "sets": "3", "reps": "8-10"},
                        {"name": "Bodyweight squats", "sets": "3", "reps": "10-12"},
                        {"name": "Plank", "sets": "3", "duration": "20-30 sec"}
                    ],
                    "flexibility": [
                        {"name": "Shoulder rolls", "duration": "2 min"},
                        {"name": "Cat-cow stretch", "duration": "2 min"},
                        {"name": "Seated forward bend", "duration": "2 min"}
                    ]
                }
            },
            "intermediate": {
                "weekly_structure": {
                    "cardio": "30-45 minutes, 4x/week",
                    "strength": "3x/week, mixed weights",
                    "flexibility": "15 minutes daily"
                },
                "exercises": {
                    "cardio": [
                        {"name": "Brisk walking", "duration": "30-45 min", "intensity": "moderate"},
                        {"name": "Jogging", "duration": "25-30 min", "intensity": "moderate"},
                        {"name": "Stationary bike", "duration": "30 min", "intensity": "moderate"}
                    ],
                    "strength": [
                        {"name": "Push-ups", "sets": "3", "reps": "10-15"},
                        {"name": "Lunges", "sets": "3", "reps": "10 per leg"},
                        {"name": "Dumbbell rows", "sets": "3", "reps": "12 per arm"}
                    ],
                    "flexibility": [
                        {"name": "Downward dog", "duration": "3 min"},
                        {"name": "Warrior pose", "duration": "2 min per side"},
                        {"name": "Child's pose", "duration": "3 min"}
                    ]
                }
            },
            "advanced": {
                "weekly_structure": {
                    "cardio": "45-60 minutes, 5x/week",
                    "strength": "4x/week, heavy weights",
                    "flexibility": "20 minutes daily"
                },
                "exercises": {
                    "cardio": [
                        {"name": "Running", "duration": "45-60 min", "intensity": "high"},
                        {"name": "HIIT workout", "duration": "30 min", "intensity": "high"},
                        {"name": "Rowing machine", "duration": "40 min", "intensity": "moderate"}
                    ],
                    "strength": [
                        {"name": "Bench press", "sets": "4", "reps": "8-10"},
                        {"name": "Deadlifts", "sets": "4", "reps": "6-8"},
                        {"name": "Pull-ups", "sets": "3", "reps": "8-12"}
                    ],
                    "flexibility": [
                        {"name": "Full yoga flow", "duration": "20 min"},
                        {"name": "Dynamic stretching", "duration": "10 min"},
                        {"name": "Foam rolling", "duration": "10 min"}
                    ]
                }
            }
        }

        plan = plans.get(request.fitness_level, plans["beginner"])

        # Filter by preferences if specified
        if request.preferences:
            # Simple preference filtering
            preferred_exercises = []
            for category, exercises in plan["exercises"].items():
                filtered = [ex for ex in exercises if any(pref.lower() in ex["name"].lower() for pref in request.preferences)]
                if filtered:
                    preferred_exercises.extend(filtered)
            if preferred_exercises:
                plan["exercises"]["preferred"] = preferred_exercises

        return {
            "fitness_level": request.fitness_level,
            "weekly_goal": f"{request.duration_week} minutes",
            "exercise_plan": plan,
            "ai_generated": True,
            "safety_tips": [
                "Check blood sugar before and after exercise",
                "Stay hydrated during workouts",
                "Stop if you feel dizzy or experience chest pain",
                "Consult your doctor before starting new exercise programs"
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/medication-reminder")
async def set_medication_reminder(reminder: MedicationReminder):
    """AI-powered medication reminder system"""
    try:
        # AI logic for medication scheduling
        reminder_schedule = {
            "medication": reminder.medication_name,
            "dosage": reminder.dosage,
            "frequency": reminder.frequency,
            "schedule": []
        }

        # Generate schedule based on frequency
        if reminder.frequency == "daily":
            for time in reminder.times:
                reminder_schedule["schedule"].append({
                    "time": time,
                    "days": "Every day"
                })
        elif reminder.frequency == "twice_daily":
            for i, time in enumerate(reminder.times[:2]):
                period = "Morning" if i == 0 else "Evening"
                reminder_schedule["schedule"].append({
                    "time": time,
                    "period": period,
                    "days": "Every day"
                })

        # Calculate duration
        from datetime import datetime, timedelta
        start_date = datetime.strptime(reminder.start_date, "%Y-%m-%d")
        if reminder.end_date:
            end_date = datetime.strptime(reminder.end_date, "%Y-%m-%d")
            duration_days = (end_date - start_date).days
        else:
            duration_days = 30  # Default 30 days

        return {
            "reminder_setup": reminder_schedule,
            "duration_days": duration_days,
            "start_date": reminder.start_date,
            "end_date": reminder.end_date,
            "ai_optimized": True,
            "compliance_tips": [
                "Set phone alarms for medication times",
                "Keep medications in a visible pill organizer",
                "Track your medication adherence",
                "Contact your doctor if you miss doses frequently"
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/symptom-log")
async def log_symptom(symptom: SymptomLog):
    """AI-powered symptom logging and analysis"""
    try:
        # AI analysis of symptoms
        symptom_analysis = {
            "symptom_type": symptom.symptom_type,
            "severity": symptom.severity,
            "description": symptom.description,
            "glucose_reading": symptom.glucose_reading,
            "timestamp": symptom.timestamp or datetime.now().isoformat(),
            "ai_insights": []
        }

        # AI-powered insights based on symptoms
        if symptom.symptom_type.lower() in ["fatigue", "tiredness"]:
            symptom_analysis["ai_insights"].append("Fatigue may be related to blood sugar fluctuations")
            if symptom.glucose_reading:
                if symptom.glucose_reading < 70:
                    symptom_analysis["ai_insights"].append("Low blood sugar may be causing fatigue")
                elif symptom.glucose_reading > 180:
                    symptom_analysis["ai_insights"].append("High blood sugar can cause fatigue")

        elif symptom.symptom_type.lower() in ["thirst", "dry mouth"]:
            symptom_analysis["ai_insights"].append("Increased thirst is a common diabetes symptom")
            symptom_analysis["ai_insights"].append("Check blood sugar and hydration levels")

        elif symptom.symptom_type.lower() in ["frequent urination"]:
            symptom_analysis["ai_insights"].append("Frequent urination may indicate high blood sugar")
            symptom_analysis["ai_insights"].append("Monitor blood sugar closely")

        # Severity-based recommendations
        if symptom.severity >= 7:
            symptom_analysis["urgency"] = "high"
            symptom_analysis["recommendations"] = [
                "Contact healthcare provider immediately",
                "Monitor blood sugar every 2 hours",
                "Seek medical attention if symptoms worsen"
            ]
        elif symptom.severity >= 4:
            symptom_analysis["urgency"] = "medium"
            symptom_analysis["recommendations"] = [
                "Monitor symptoms closely",
                "Check blood sugar regularly",
                "Contact doctor if symptoms persist"
            ]
        else:
            symptom_analysis["urgency"] = "low"
            symptom_analysis["recommendations"] = [
                "Continue monitoring",
                "Maintain regular diabetes management",
                "Log symptoms daily"
            ]

        return {
            "symptom_log": symptom_analysis,
            "ai_analyzed": True,
            "follow_up": "Monitor symptoms and consult healthcare provider if needed"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/educational-content")
async def get_educational_content(request: EducationalContent):
    """AI-powered educational content delivery"""
    try:
        # AI-curated educational content
        content_library = {
            "blood_sugar_monitoring": {
                "beginner": {
                    "title": "Understanding Blood Sugar Monitoring",
                    "content": "Blood sugar monitoring is crucial for diabetes management...",
                    "key_points": ["Check fasting blood sugar", "Monitor after meals", "Track patterns"]
                },
                "intermediate": {
                    "title": "Advanced Blood Sugar Management",
                    "content": "Understanding blood sugar patterns and trends...",
                    "key_points": ["Time-in-range goals", "Glycemic variability", "Pattern recognition"]
                }
            },
            "medication_management": {
                "beginner": {
                    "title": "Diabetes Medications Basics",
                    "content": "Learn about different types of diabetes medications...",
                    "key_points": ["Oral medications", "Insulin types", "Proper administration"]
                }
            },
            "nutrition": {
                "beginner": {
                    "title": "Diabetes-Friendly Nutrition",
                    "content": "Eating right is essential for blood sugar control...",
                    "key_points": ["Carb counting", "Glycemic index", "Portion control"]
                }
            }
        }

        topic_content = content_library.get(request.topic, {})
        level_content = topic_content.get(request.difficulty, topic_content.get("beginner", {}))

        if not level_content:
            level_content = {
                "title": f"Introduction to {request.topic.replace('_', ' ').title()}",
                "content": f"Learn the basics of {request.topic.replace('_', ' ')} in diabetes management.",
                "key_points": ["Consult healthcare providers", "Stay informed", "Practice regularly"]
            }

        return {
            "topic": request.topic,
            "difficulty": request.difficulty,
            "content_type": request.content_type,
            "educational_material": level_content,
            "ai_curated": True,
            "additional_resources": [
                "American Diabetes Association website",
                "Local diabetes education programs",
                "Healthcare provider consultations"
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/diabetes-stats")
def get_diabetes_statistics():
    """AI-analyzed diabetes statistics and insights"""
    try:
        # AI-powered statistics and insights
        stats = {
            "global_statistics": {
                "prevalence": "537 million people worldwide have diabetes",
                "type_distribution": {
                    "type1": "10%",
                    "type2": "90%",
                    "other_types": "less than 1%"
                },
                "annual_cost": "$966 billion globally"
            },
            "key_insights": [
                "1 in 10 adults has diabetes",
                "Type 2 diabetes is largely preventable",
                "Early diagnosis improves outcomes",
                "Lifestyle changes can prevent or delay diabetes"
            ],
            "risk_factors": [
                "Family history",
                "Overweight/obesity",
                "Physical inactivity",
                "Unhealthy diet",
                "Age over 45"
            ],
            "ai_analysis": {
                "trend": "Increasing prevalence due to lifestyle factors",
                "prevention_priority": "High",
                "management_focus": "Early intervention and lifestyle modification"
            }
        }

        return {
            "diabetes_statistics": stats,
            "ai_analyzed": True,
            "last_updated": datetime.now().isoformat(),
            "source": "WHO and International Diabetes Federation"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "enhanced_nlp_available": ENHANCED_NLP_AVAILABLE,
        "ai_features": [
            "predict-risk",
            "ai-chat",
            "analyze-text",
            "meal-plan",
            "exercise-plan",
            "medication-reminder",
            "symptom-log",
            "educational-content",
            "diabetes-stats"
        ],
        "total_endpoints": 9
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
