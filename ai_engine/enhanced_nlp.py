"""
Enhanced Natural Language Processing for Diabetes Chat Analysis
Provides advanced text analysis, sentiment detection, and contextual understanding
"""

import re
import spacy
from textblob import TextBlob
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
import numpy as np
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass
import logging

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
        try:
            # Load spaCy model
            self.nlp = spacy.load("en_core_web_sm")
        except OSError:
            logger.warning("spaCy model not found. Install with: python -m spacy download en_core_web_sm")
            self.nlp = None
            
        self.sentiment_analyzer = SentimentIntensityAnalyzer()
        
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
        
        # Use spaCy for NER if available
        if self.nlp:
            doc = self.nlp(text)
            for ent in doc.ents:
                entities.append({
                    'text': ent.text,
                    'label': ent.label_,
                    'start': ent.start_char,
                    'end': ent.end_char
                })
        
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
        """Advanced sentiment analysis using multiple methods"""
        results = {}
        
        # VADER sentiment
        vader_scores = self.sentiment_analyzer.polarity_scores(text)
        results['vader_compound'] = vader_scores['compound']
        
        # TextBlob sentiment
        blob = TextBlob(text)
        results['textblob_polarity'] = blob.sentiment.polarity
        results['textblob_subjectivity'] = blob.sentiment.subjectivity
        
        # Combined sentiment score
        results['combined_score'] = (vader_scores['compound'] + blob.sentiment.polarity) / 2
        
        return results

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
        """Extract important keywords using TF-IDF and diabetes context"""
        # Simple keyword extraction for now
        # In production, use scikit-learn's TfidfVectorizer
        words = re.findall(r'\b\w+\b', text.lower())
        
        # Filter for diabetes-relevant keywords
        diabetes_keywords = []
        for word in words:
            if (word in str(self.diabetes_entities).lower() or 
                word in str(self.emotion_keywords).lower() or
                word.isdigit() and 20 <= int(word) <= 600):
                diabetes_keywords.append(word)
        
        return list(set(diabetes_keywords))

    def generate_recommendations(self, insights: Dict, intent: str, emotion: str) -> List[str]:
        """Generate personalized recommendations based on analysis"""
        recommendations = []

        if intent == 'medication_inquiry':
            recommendations.append("Please consult your doctor before making any medication changes.")
        if insights.get('glucose_readings'):
            high_readings = [r for r in insights['glucose_readings'] if r > 180]
            if high_readings:
                recommendations.append("High glucose readings detected. Consider checking with your healthcare provider.")
        if insights.get('symptom_flags'):
            recommendations.append("Symptoms detected. Monitor closely and consult your doctor if they persist.")
        if emotion in ['fear', 'sadness']:
            recommendations.append("If you're feeling anxious or down, consider talking to a support group or counselor.")
        if not recommendations:
            recommendations.append("Keep monitoring your health and maintain a healthy lifestyle.")

        return recommendations

    def analyze(self, text: str, user_context: Optional[Dict] = None) -> AnalysisResult:
        """Main analysis method that combines all NLP features"""
        try:
            # Preprocess text
            cleaned_text = self.preprocess_text(text)

            # Extract entities
            entities = self.extract_entities(cleaned_text)

            # Sentiment analysis
            sentiment_scores = self.analyze_sentiment(cleaned_text)
            combined_sentiment = sentiment_scores['combined_score']

            # Emotion detection
            emotion = self.detect_emotion(cleaned_text)

            # Extract keywords
            keywords = self.extract_keywords(cleaned_text)

            # Classify intent
            intent = self.classify_intent(cleaned_text, entities)

            # Extract diabetes insights
            diabetes_insights = self.extract_diabetes_insights(cleaned_text, entities)

            # Determine urgency level
            urgency_level = 'low'
            if diabetes_insights.get('urgency_indicators'):
                if 'critical' in diabetes_insights['urgency_indicators']:
                    urgency_level = 'critical'
                elif 'high' in diabetes_insights['urgency_indicators']:
                    urgency_level = 'high'
                elif 'medium' in diabetes_insights['urgency_indicators']:
                    urgency_level = 'medium'

            # Generate recommendations
            recommendations = self.generate_recommendations(diabetes_insights, intent, emotion)

            # Calculate confidence (simple heuristic)
            confidence = min(1.0, len(entities) * 0.1 + len(keywords) * 0.05 + abs(combined_sentiment) * 0.2)

            return AnalysisResult(
                original_text=text,
                cleaned_text=cleaned_text,
                sentiment_score=combined_sentiment,
                emotion=emotion,
                confidence=confidence,
                entities=entities,
                keywords=keywords,
                intent=intent,
                urgency_level=urgency_level,
                diabetes_specific_insights=diabetes_insights,
                recommendations=recommendations
            )
        except Exception as e:
            logger.error(f"Error analyzing text: {e}")
            return AnalysisResult(
                original_text=text,
                cleaned_text=text,
                sentiment_score=0.0,
                emotion='neutral',
                confidence=0.0,
                entities=[],
                keywords=[],
                intent='general_chat',
                urgency_level='low',
                diabetes_specific_insights={},
                recommendations=['Please consult a healthcare professional for personalized advice.']
            )
