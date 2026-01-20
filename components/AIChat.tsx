import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Send, Bot, User } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: string;
  suggestions?: string[];
  confidence?: number;
}

interface AIChatProps {
  userId: string;
}

interface AIContext {
  recent_readings?: any[];
  missed_tasks?: any[];
  risk_category?: string;
  medication_reminders?: any[];
}

export function AIChat({ userId }: AIChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [aiContext, setAiContext] = useState<AIContext>({});
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    loadUserContext();
    // Add welcome message
    setMessages([
      {
        id: '1',
        text: "Hello! I'm your AI diabetes assistant. I can help you with blood sugar management, medication reminders, diet advice, and exercise recommendations. What would you like to discuss?",
        sender: 'ai',
        timestamp: new Date().toISOString(),
        suggestions: ['Check my blood sugar', 'Medication advice', 'Diet tips', 'Exercise guidance']
      }
    ]);
  }, [userId]);

  const loadUserContext = async () => {
    try {
      // Fetch recent blood sugar readings
      const { data: readings } = await supabase
        .from('blood_sugar_readings')
        .select('*')
        .eq('user_id', userId)
        .order('recorded_at', { ascending: false })
        .limit(5);

      // Fetch missed tasks
      const { data: tasks } = await supabase
        .from('diabetes_tasks')
        .select('*')
        .eq('user_id', userId)
        .eq('completed', false)
        .order('created_at', { ascending: false })
        .limit(5);

      // Fetch medication reminders
      const { data: medications } = await supabase
        .from('medication_reminders')
        .select('*')
        .eq('user_id', userId)
        .eq('active', true);

      setAiContext({
        recent_readings: readings || [],
        missed_tasks: tasks || [],
        medication_reminders: medications || []
      });
    } catch (error) {
      console.error('Error loading user context:', error);
    }
  };

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: input,
      sender: 'user',
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      // Call AI API
      const response = await fetch('http://localhost:8000/ai-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: input,
          user_id: userId,
          context: aiContext
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get AI response');
      }

      const aiData = await response.json();
      
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: aiData.response,
        sender: 'ai',
        timestamp: new Date().toISOString(),
        suggestions: aiData.suggestions,
        confidence: aiData.confidence
      };

      setMessages(prev => [...prev, aiMessage]);
      
    } catch (error) {
      console.error('Error getting AI response:', error);
      Alert.alert('Error', 'Failed to get AI response. Please try again.');
      
      // Fallback response
      const fallbackMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: "I'm having trouble connecting to the AI service. Please check your internet connection and try again.",
        sender: 'ai',
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, fallbackMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestion = (suggestion: string) => {
    setInput(suggestion);
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.sender === 'user';
    
    return (
      <View style={[styles.messageContainer, isUser ? styles.userMessage : styles.aiMessage]}>
        <View style={styles.messageHeader}>
          {isUser ? (
            <User size={16} color="#0066CC" />
          ) : (
            <Bot size={16} color="#10B981" />
          )}
          <Text style={styles.senderText}>
            {isUser ? 'You' : 'AI Assistant'}
          </Text>
        </View>
        
        <Text style={styles.messageText}>{item.text}</Text>
        
        {item.suggestions && item.suggestions.length > 0 && (
          <View style={styles.suggestionsContainer}>
            <Text style={styles.suggestionsTitle}>Suggestions:</Text>
            {item.suggestions.map((suggestion, index) => (
              <TouchableOpacity
                key={index}
                style={styles.suggestionButton}
                onPress={() => handleSuggestion(suggestion)}
              >
                <Text style={styles.suggestionText}>{suggestion}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        
        {item.confidence && (
          <Text style={styles.confidenceText}>
            Confidence: {(item.confidence * 100).toFixed(0)}%
          </Text>
        )}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={item => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          value={input}
          onChangeText={setInput}
          placeholder="Ask about diabetes management..."
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[styles.sendButton, !input.trim() && styles.sendButtonDisabled]}
          onPress={sendMessage}
          disabled={!input.trim() || loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Send size={20} color="white" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFB',
  },
  messagesList: {
    padding: 16,
    paddingBottom: 80,
  },
  messageContainer: {
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    maxWidth: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#EBF4FF',
    borderBottomRightRadius: 4,
  },
  aiMessage: {
    alignSelf: 'flex-start',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderBottomLeftRadius: 4,
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  senderText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
    color: '#64748B',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
    color: '#1E293B',
  },
  suggestionsContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  suggestionsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 8,
  },
  suggestionButton: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 4,
  },
  suggestionText: {
    fontSize: 12,
    color: '#475569',
  },
  confidenceText: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    borderTopWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: 'white',
    position: 'absolute',
    bottom: 0,
    width: '100%',
  },
  textInput: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    maxHeight: 120,
    color: '#1E293B',
  },
  sendButton: {
    backgroundColor: '#0066CC',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: '#94A3B8',
    opacity: 0.5,
  },
});
