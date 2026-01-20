"""
Enhanced Natural Language Processing for Diabetes Chat Analysis
Provides advanced text analysis, sentiment detection, and contextual understanding
"""

import re
import logging
from typing import Dict, List, Optional
from dataclasses import dataclass

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class AnalysisResult:
    """Structured analysis result for chat messages"""
    original_text: str
    cleaned_text: str
    sentiment_score: float
    emotion: str
    confidence: float
    entities: List[Dict]
    keywords: List[str]
    intent: str
    urgency_level: str
    diabetes_specific_insights: Dict
    recommendations: List[str]

class EnhancedDiabetesNLP:
    """Advanced NLP analyzer for diabetes chat messages"""
    
    def __init__(self):
        # Enhanced diabetes vocabulary
        self.diabetes_entities = {
            'medication': [
                'metformin', 'insulin', 'glipizide', 'glyburide', 'januvia', 'victoza',
                'ozempic', 'trulicity', 'invokana', 'farxiga', 'jardiance', 'humalog',
                'novolog', 'lantus', 'levemir', 'tresiba', 'toujeo', 'apidra'
            ],
            'symptom': [
                'thirsty', 'tired', 'fatigue', 'blurry vision', 'frequent urination',
                'hunger', 'weight loss', 'weight gain', 'slow healing', 'infections',
                'numbness', 'tingling', 'dry skin', 'headaches', 'dizziness'
            ],
            'measurement': [
                'glucose', 'sugar', 'bg', 'blood sugar', 'hba1c', 'a1c', 'ketones',
                'bmi', 'weight', 'blood pressure', 'bp', 'cholesterol', 'triglycerides'
            ],
            'lifestyle': [
                'diet', 'exercise', 'workout', 'walking', 'running', 'swimming',
                'cycling', 'yoga', 'meditation', 'sleep', 'stress', 'meal plan',
                'carb counting', 'portion control', 'fasting'
            ]
        }
        
        # Emotion keywords
        self.emotion_keywords = {
            'fear': ['scared', 'afraid', 'worried', 'anxious', 'terrified', 'panic'],
            'sadness': ['sad', 'depressed', 'down', 'blue', 'miserable', 'hopeless'],
            'anger': ['angry', 'frustrated', 'mad', 'irritated', 'furious', 'annoyed'],
            'joy': ['happy', 'excited', 'joyful', 'glad', 'pleased', 'delighted'],
            'surprise': ['surprised', 'shocked', 'amazed', 'astonished', 'startled']
        }
        
        # Urgency indicators
        self.urgency_indicators = {
            'critical': ['emergency', 'urgent', 'critical', 'severe', 'danger', 'help', '911'],
            'high': ['high', 'very', 'extremely', 'alarming', 'concerning', 'worried'],
            'medium': ['moderate', 'some', 'slightly', 'mild', 'uncomfortable']
        }

    def preprocess_text(self, text: str) -> str:
        """Clean and preprocess text for analysis"""
        # Remove extra whitespace and normalize
        text = re.sub(r'\s+', ' ', text.strip())
        
        # Handle common abbreviations
        text = re.sub(r'\b(bg)\b', 'blood glucose', text, flags=re.IGNORECASE)
        text = re.sub(r'\b(bs)\b', 'blood sugar', text, flags=re.IGNORECASE)
        text = re.sub(r'\b(hba1c)\b', 'hemoglobin a1c', text, flags=re.IGNORECASE)
        
        return text

    def extract_entities(self, text: str) -> List[Dict]:
        """Extract diabetes-related entities from text"""
        entities = []
        
        # Custom entity extraction for diabetes terms
        text_lower = text.lower()
        
        for category, terms in self.diabetes_entities.items():
            for term in terms:
                if term.lower() in text_lower:
                    entities.append({
                        'text': term,
                        'label': category.upper(),
                        'confidence': 0.9
                    })
        
        return entities

    def analyze_sentiment(self, text: str) -> Dict[str, float]:
        """Advanced sentiment analysis using simple rules"""
        # Simple sentiment analysis based on keywords
        positive_words = ['good', 'great', 'better', 'improved', 'excellent', 'perfect', 'happy', 'fine']
        negative_words = ['bad', 'worst', 'terrible', 'awful', 'poor', 'worse', 'sad', 'angry']
        
        text_lower = text.lower()
        positive_count = sum(1 for word in positive_words if word in text_lower)
        negative_count = sum(1 for word in negative_words if word in text_lower)
        
        if positive_count > negative_count:
            sentiment_score = 0.5 + (positive_count * 0.1)
        elif negative_count > positive_count:
            sentiment_score = -0.5 - (negative_count * 0.1)
        else:
            sentiment_score = 0.0
        
        return {'combined_score': max(-1.0, min(1.0, sentiment_score))}

    def detect_emotion(self, text: str) -> str:
        """Detect specific emotions in the text"""
        text_lower = text.lower()
        
        for emotion, keywords in self.emotion_keywords.items():
            if any(keyword in text_lower for keyword in keywords):
                return emotion
        
        return 'neutral'

    def extract_diabetes_insights(self, text: str, entities: List[Dict]) -> Dict:
        """Extract diabetes-specific insights from text"""
        insights = {
            'glucose_readings': [],
            'medication_mentions': [],
            'symptom_flags': [],
            'lifestyle_factors': [],
            'urgency_indicators': []
        }
        
        # Extract glucose readings
        glucose_pattern = r'(\d{2,3})\s*(mg/dl|mg|mmol/l)?'
        glucose_matches = re.findall(glucose_pattern, text, re.IGNORECASE)
        insights['glucose_readings'] = [int(match[0]) for match in glucose_matches if 20 <= int(match[0]) <= 600]
        
        # Extract medication mentions
        for entity in entities:
            if entity['label'] == 'MEDICATION':
                insights['medication_mentions'].append(entity['text'])
        
        # Detect symptoms
        for symptom in self.diabetes_entities['symptom']:
            if symptom.lower() in text.lower():
                insights['symptom_flags'].append(symptom)
        
        # Detect urgency
        for level, indicators in self.urgency_indicators.items():
            if any(indicator in text.lower() for indicator in indicators):
                insights['urgency_indicators'].append(level)
        
        return insights

    def classify_intent(self, text: str, entities: List[Dict]) -> str:
        """Classify the user's intent"""
        text_lower = text.lower()
        
        # Intent classification rules
        if any(word in text_lower for word in ['what', 'how', 'why', 'when']):
            return 'question'
        elif any(word in text_lower for word in ['help', 'advice', 'recommend']):
            return 'advice_request'
        elif any(entity['label'] == 'MEDICATION' for entity in entities):
            return 'medication_inquiry'
        elif any(entity['label'] == 'MEASUREMENT' for entity in entities):
            return 'measurement_query'
        elif any(word in text_lower for word in ['thank', 'thanks', 'appreciate']):
            return 'gratitude'
        else:
            return 'general_chat'

    def extract_keywords(self, text: str) -> List[str]:
        """Extract important keywords using diabetes context"""
        words = re.findall(r'\b\w+\b', text.lower())
        
        # Filter for diabetes-relevant keywords
        diabetes_keywords = []
        for word in words:
            if (word in str(self.diabetes_entities).lower() or 
                word in str(self.emotion_keywords).lower() or
                (word.isdigit() and 20 <= int(word) <= 600)):
                diabetes_keywords.append(word)
        
        return list(set(diabetes_keywords))

    def analyze(self, text: str, user_context: Optional[Dict] = None) -> AnalysisResult:
        """Main analysis method that combines all NLP features"""
        try:
            # Preprocess text
            cleaned_text = self.preprocess_text(text)
            
            # Extract entities
            entities = self.extract_entities(cleaned_text)
            
            # Sentiment analysis
            sentiment_result = self.analyze_sentiment(cleaned_text)
            combined_sentiment = sentiment_result['combined_score']
            
            # Emotion detection
            emotion = self.detect_emotion(cleaned_text)
            
            # Extract diabetes insights
            insights = self.extract_diabetes_insights(cleaned_text, entities)
            
            # Classify intent
            intent = self.classify_intent(cleaned_text, entities)
            
            # Determine urgency level
            urgency_level = 'low'
            if 'critical' in insights['urgency_indicators']:
                urgency_level = 'critical'
            elif 'high' in insights['urgency_indicators']:
                urgency_level = 'high'
            elif 'medium' in insights['urgency_indicators']:
                urgency_level = 'medium'
            
            # Generate recommendations
            recommendations = []
            
            if insights['glucose_readings']:
                avg_glucose = sum(insights['glucose_readings']) / len(insights['glucose_readings'])
                if avg_glucose > 180:
                    recommendations.append("Consider checking with your healthcare provider about high readings")
                elif avg_glucose < 70:
                    recommendations.append("Have a quick-acting carbohydrate available for low blood sugar")
                else:
                    recommendations.append("Your readings look good - keep monitoring regularly")
            
            if insights['medication_mentions']:
                recommendations.append("Ensure you're taking medications as prescribed")
            
            if insights['symptom_flags']:
                recommendations.append("Discuss these symptoms with your healthcare provider")
            
            if not recommendations:
                recommendations = [
                    "Keep monitoring your blood sugar regularly",
                    "Stay consistent with your diabetes management routine",
                    "Reach out if you have any concerns"
                ]
            
            # Calculate confidence
            confidence = 0.85
            if len(entities) > 0:
                confidence += 0.1
            if len(insights['glucose_readings']) > 0:
                confidence += 0.05
            confidence = min(confidence, 1.0)
            
            return AnalysisResult(
                original_text=text,
                cleaned_text=cleaned_text,
                sentiment_score=combined_sentiment,
                emotion=emotion,
                confidence=confidence,
                entities=entities,
                keywords=self.extract_keywords(cleaned_text),
                intent=intent,
                urgency_level=urgency_level,
                diabetes_specific_insights=insights,
                recommendations=recommendations
            )
            
        except Exception as e:
            logger.error(f"Error in analysis: {str(e)}")
            return AnalysisResult(
                original_text=text,
                cleaned_text=text,
                sentiment_score=0.0,
                emotion='neutral',
                confidence=0.5,
                entities=[],
                keywords=[],
                intent='general_chat',
                urgency_level='low',
                diabetes_specific_insights={},
                recommendations=["I'm having trouble analyzing this message. Please try again."]
            )

# Initialize the enhanced NLP analyzer
enhanced_analyzer = EnhancedDiabetesNLP()
