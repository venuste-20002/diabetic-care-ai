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
            
           <thinking>
I have reviewed the AI chat backend in enhanced_main.py. It has a DiabetesAIAnalyzer class that analyzes user messages by detecting keywords, extracting numerical readings, performing basic sentiment analysis, and calculating urgency. It then generates responses based on detected categories with advice templates.

The frontend chat component (AIChat.tsx) sends user messages to the backend endpoint /ai-chat and displays the AI response.

To improve the "word analysis" as the user requested, possible enhancements include:
- Expanding keyword detection with synonyms or NLP techniques (e.g., lemmatization)
- Adding more advanced natural language understanding (e.g., intent classification)
- Improving sentiment analysis with a more robust library or model
- Adding entity recognition (e.g., recognizing medication names, symptoms)
- Using contextual embeddings or pretrained language models for better understanding

I will now create a detailed plan for improving the word analysis in the chat system, focusing on enhancing the backend analyzer and possibly updating the frontend to support richer responses.

Dependent files to edit:
- glucogard/ai_engine/enhanced_main.py (improve DiabetesAIAnalyzer)
- glucogard/components/AIChat.tsx (if needed, to display new info or handle new response fields)

Follow-up steps:
- Implement improvements in enhanced_main.py
- Test with sample messages
- Update frontend if needed
- Verify end-to-end chat functionality

I will now present this plan for your confirmation before proceeding.
</thinking>

<ask_followup_question>
<question>
I have analyzed your chat system's current word analysis implementation. To improve it, I propose enhancing the backend DiabetesAIAnalyzer with more advanced NLP techniques such as expanded keyword detection, better sentiment analysis, and possibly entity recognition. We may also update the frontend AIChat component if needed to support richer responses.

The plan includes:
- Enhancing keyword detection and categories in enhanced_main.py
- Improving sentiment analysis logic
- Adding entity recognition for medications, symptoms, etc.
- Optionally updating AIChat.tsx to display new insights or confidence scores

Please confirm if you want me to proceed with this plan or provide any specific improvements you want.
</question>
</ask_followup_question>
