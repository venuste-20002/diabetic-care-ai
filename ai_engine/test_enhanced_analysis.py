"""
Test script for enhanced diabetes chat analysis
"""

import sys
from pathlib import Path

# Add current directory to path
sys.path.append(str(Path(__file__).parent))

try:
    from enhanced_nlp_fixed import enhanced_analyzer
    
    # Test messages
    test_messages = [
        "My blood sugar was 250 this morning and I'm feeling really worried",
        "I forgot to take my metformin yesterday and now I feel terrible",
        "I've been having blurry vision and frequent urination lately",
        "My glucose levels have been great lately - around 120 consistently!",
        "I need help with my diet plan and carb counting",
        "Emergency! My blood sugar is 400 and I feel very sick"
    ]
    
    print("=== Enhanced Diabetes Chat Analysis Test ===\n")
    
    for i, message in enumerate(test_messages, 1):
        print(f"Test {i}: {message}")
        print("-" * 50)
        
        try:
            result = enhanced_analyzer.analyze(message)
            print(f"Intent: {result.intent}")
            print(f"Sentiment Score: {result.sentiment_score:.2f}")
            print(f"Emotion: {result.emotion}")
            print(f"Urgency: {result.urgency_level}")
            print(f"Confidence: {result.confidence:.2f}")
            print(f"Entities: {[e['text'] for e in result.entities]}")
            print(f"Keywords: {result.keywords}")
            print(f"Glucose Readings: {result.diabetes_specific_insights['glucose_readings']}")
            print(f"Recommendations: {result.recommendations}")
            print("=" * 50)
            
        except Exception as e:
            print(f"Error analyzing message: {e}")
            print("=" * 50)
            
except ImportError as e:
    print(f"Could not import enhanced analyzer: {e}")
    print("Please ensure enhanced_nlp_fixed.py is in the same directory")
