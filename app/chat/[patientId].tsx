// ChatScreen.tsx
import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet, 
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Image,
  Dimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Send, ArrowLeft, User, Stethoscope, Clock, Image as ImageIcon, Smile, Paperclip, Mic, Shield } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { Tables } from '@/types/database';

const { width, height } = Dimensions.get('window');

type Message = Tables<'messages'>;

interface Patient {
  id: string;
  profiles: {
    full_name: string;
  };
}

interface Doctor {
  id: string;
  profiles: {
    full_name: string;
  };
}

export default function ChatScreen() {
  const router = useRouter();
  const { patientId } = useLocalSearchParams<{ patientId: string }>();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [currentDoctor, setCurrentDoctor] = useState<Doctor | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const channelRef = useRef<any>(null);

  // Memoize the message handler to prevent unnecessary re-subscriptions
  const handleNewMessage = useCallback((payload: any) => {
    setMessages((prev) => [...prev, payload.new as Message]);
    scrollToBottom();
  }, []);

  const fetchChatContext = useCallback(async () => {
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData.user) throw new Error('User not authenticated. Please log in.');

      const { data, error } = await supabase.rpc('get_chat_context', {
        p_patient_id: patientId,
        d_user_id: authData.user.id,
      });

      if (error) throw error;

      if (data) {
        const chatContext = data as unknown as {
          patient: Patient | null;
          doctor: Doctor | null;
        };
        if (!chatContext.patient || !chatContext.doctor) {
          throw new Error('Could not load patient or doctor information. The user may not exist or you may not have permission.');
        }
        setPatient(chatContext.patient);
        setCurrentDoctor(chatContext.doctor);
        return true;
      }
      // if data is null
      throw new Error('Failed to retrieve chat context from the server.');
    } catch (err) {
      console.error('Error fetching chat context:', err);
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred while loading chat information.';
      setError(errorMessage);
      return false;
    }
  }, [patientId]);

  const fetchMessages = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (err) {
      console.error('Error fetching messages:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load messages.';
      setError(errorMessage);
    }
  }, [patientId]);

  const subscribeToMessages = useCallback(() => {
    // Clean up existing channel if it exists
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase
      .channel(`chat:${patientId}:${Date.now()}`) // Add timestamp to ensure unique channel names
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `patient_id=eq.${patientId}`,
        },
        handleNewMessage
      )
      .subscribe();

    channelRef.current = channel;
    return channel;
  }, [patientId, handleNewMessage]);

  useEffect(() => {
    if (!patientId) {
      setError("No patient ID provided.");
      setLoading(false);
      return;
    }

    const loadChatData = async () => {
      setLoading(true);
      setError(null);

      const contextSuccess = await fetchChatContext();
      if (contextSuccess) {
        await fetchMessages();
        subscribeToMessages();
      }
      
      setLoading(false);
    };

    loadChatData();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [patientId, fetchChatContext, fetchMessages, subscribeToMessages]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !currentDoctor || sending) return;

    setSending(true);
    try {
      const { data: chat, error: chatError } = await supabase
        .from('chats')
        .select('id')
        .eq('patient_id', patientId)
        .eq('doctor_id', currentDoctor.id)
        .single();

      if (chatError && chatError.code !== 'PGRST116') {
        throw chatError;
      }

      let chatId = chat?.id;
      if (!chatId) {
        const { data: newChat, error: newChatError } = await supabase
          .from('chats')
          .insert({
            patient_id: patientId!,
            doctor_id: currentDoctor.id,
          })
          .select('id')
          .single();

        if (newChatError) throw newChatError;
        chatId = newChat.id;
      }

      const { error } = await supabase.from('messages').insert({
        message: newMessage.trim(),
        sender_id: currentDoctor.id,
        patient_id: patientId!,
        chat_id: chatId,
        sender_type: 'doctor',
      });

      if (error) throw error;
      setNewMessage('');
      scrollToBottom();
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderMessage = ({ item }: { item: Message }) => {
    if (!currentDoctor || !patient) {
      return null; // Don't render messages until context is loaded
    }
    const isDoctor = item.sender_id === currentDoctor?.id;

    return (
      <View
        style={[
          styles.messageContainer,
          isDoctor ? styles.doctorMessage : styles.patientMessage,
        ]}
      >
        <View style={styles.messageHeader}>
          <View style={styles.senderInfo}>
            {isDoctor ? (
              <Stethoscope size={16} color="#0066CC" />
            ) : (
              <User size={16} color="#666" />
            )}
            <Text style={styles.senderName}>
              {isDoctor
                ? 'Dr. ' + (currentDoctor?.profiles.full_name || 'Doctor')
                : patient?.profiles.full_name || 'Patient'}
            </Text>
          </View>
          <View style={styles.timeContainer}>
            <Clock size={12} color="#999" />
            <Text style={styles.messageTime}>{formatTime(item.created_at)}</Text>
          </View>
        </View>
        <Text style={styles.messageContent}>{item.message}</Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0066CC" />
        <Text style={styles.loadingText}>Loading chat...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Error: {error}</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButtonError}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => router.back()} 
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <ArrowLeft size={24} color="#0066CC" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          {patient?.profiles.full_name ? (
            <View style={styles.avatarContainer}>
              <View style={styles.avatar}>
                <User size={24} color="#0066CC" />
              </View>
            </View>
          ) : (
            <User size={24} color="#0066CC" />
          )}
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>
              {patient?.profiles.full_name || 'Patient'}
            </Text>
            <Text style={styles.headerSubtitle}>
              {messages.length > 0 ? 'Active now' : 'Start a conversation'}
            </Text>
          </View>
        </View>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={item => item.id.toString()}
        renderItem={renderMessage}
        style={styles.messagesList}
        contentContainerStyle={styles.messagesContainer}
        onContentSizeChange={() => scrollToBottom()}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Image 
              source={{ uri: 'https://images.pexels.com/photos/3938023/pexels-photo-3938023.jpeg?auto=compress&cs=tinysrgb&w=800' }}
              style={styles.emptyImage}
            />
            <Text style={styles.emptyTitle}>Start a conversation</Text>
            <Text style={styles.emptyText}>
              Send a message to begin communicating with {patient?.profiles.full_name || 'your patient'}
            </Text>
          </View>
        }
      />

      {/* Input */}
      <View style={styles.inputContainer}>
         <TouchableOpacity style={styles.attachButton}>
           <Paperclip size={20} color="#64748B" />
         </TouchableOpacity>
        <TextInput
          style={styles.textInput}
          value={newMessage}
          onChangeText={setNewMessage}
          placeholder="Type a message..."
          multiline
          maxLength={500}
          placeholderTextColor="#94A3B8"
        />
         <View style={styles.inputActions}>
           <TouchableOpacity style={styles.emojiButton}>
             <Smile size={20} color="#64748B" />
           </TouchableOpacity>
           <TouchableOpacity
             style={[
               styles.sendButton,
               (!newMessage.trim() || sending) && styles.sendButtonDisabled
             ]}
             onPress={sendMessage}
             disabled={!newMessage.trim() || sending}
           >
             {sending ? (
               <ActivityIndicator size="small" color="white" />
             ) : (
               <Send size={20} color="white" />
             )}
           </TouchableOpacity>
         </View>
      </View>
       
       {/* Security Notice */}
       <View style={styles.securityNotice}>
         <Shield size={12} color="#94A3B8" />
         <Text style={styles.securityText}>End-to-end encrypted</Text>
       </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: 'center', 
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  errorText: {
    fontSize: 16,
    color: 'red',
    textAlign: 'center',
    marginBottom: 20,
  },
  backButtonError: {
    backgroundColor: '#0066CC',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
  },
  container: {
    flex: 1,
    backgroundColor: '#F8FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingTop: Platform.OS === 'ios' ? 60 : 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EBF4FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 2,
  },
  messagesList: {
    flex: 1,
  },
  messagesContainer: {
    padding: 16,
    paddingBottom: 80,
  },
  messageContainer: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    maxWidth: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  doctorMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#EBF4FF',
    borderBottomRightRadius: 4,
  },
  patientMessage: {
    alignSelf: 'flex-start',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderBottomLeftRadius: 4,
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  senderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  senderName: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
    color: '#64748B',
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  messageTime: {
    fontSize: 11,
    color: '#94A3B8',
    marginLeft: 4,
  },
  messageContent: {
    fontSize: 16,
    lineHeight: 22,
    color: '#1E293B',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  attachButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
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
  inputActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emojiButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyImage: {
    width: 200,
    height: 200,
    borderRadius: 16,
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
  },
  securityNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 6,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    position: 'absolute',
    bottom: 64,
    left: 0,
    right: 0,
  },
  securityText: {
    fontSize: 10,
    color: '#94A3B8',
  },
});