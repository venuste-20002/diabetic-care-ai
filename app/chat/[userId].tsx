import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
}

export default function ChatScreen() {
  const { user } = useAuth();
  const { userId } = useLocalSearchParams(); // The patient or doctor you're chatting with
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!user || !userId) return;

    // Fetch chat messages between logged-in user and userId
    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from<Message>('messages')
        .select('*')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${user.id})`)
        .order('created_at', { ascending: true });

      if (!error && data) {
        setMessages(data);
      }
    };

    fetchMessages();

    // Subscribe to new messages for real-time updates
    const subscription = supabase
      .from<Message>(`messages:receiver_id=eq.${user.id}`)
      .on('INSERT', (payload: { new: any; }) => {
        const newMsg = payload.new;
        if (
          (newMsg.sender_id === userId && newMsg.receiver_id === user.id) ||
          (newMsg.sender_id === user.id && newMsg.receiver_id === userId)
        ) {
          setMessages(prev => [...prev, newMsg]);
          flatListRef.current?.scrollToEnd({ animated: true });
        }
      })
      .subscribe();

    return () => {
      supabase.removeSubscription(subscription);
    };
  }, [user, userId]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !user) return;

    // Send user message to Supabase
    const { error: userError } = await supabase.from('messages').insert([
      {
        sender_id: user.id,
        receiver_id: userId,
        content: newMessage.trim(),
      },
    ]);

    if (userError) {
      console.error('Error sending user message:', userError);
      return;
    }

    setNewMessage('');

    // Send user message to AI chat endpoint
    try {
      const response = await fetch('http://localhost:8000/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: newMessage.trim() }),
      });

      if (!response.ok) {
        console.error('Error from AI chat endpoint:', response.statusText);
        return;
      }

      const data = await response.json();
      const aiAdvice = data.advice;

      // Insert AI response as a new message in Supabase with sender_id 'ai_bot'
      const { error: aiError } = await supabase.from('messages').insert([
        {
          sender_id: 'ai_bot',
          receiver_id: user.id,
          content: aiAdvice,
        },
      ]);

      if (aiError) {
        console.error('Error sending AI message:', aiError);
      }
    } catch (err) {
      console.error('Error communicating with AI chat endpoint:', err);
    }
  };

  const renderItem = ({ item }: { item: Message }) => {
    const isMine = item.sender_id === user?.id;
    return (
      <View
        style={[
          styles.messageContainer,
          isMine ? styles.myMessage : styles.theirMessage,
        ]}
      >
        <Text style={isMine ? styles.myText : styles.theirText}>{item.content}</Text>
        <Text style={styles.timestamp}>
          {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.select({ ios: 'padding', android: undefined })}
      keyboardVerticalOffset={90}
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16 }}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

      <View style={styles.inputRow}>
        <TextInput
          placeholder="Type your message..."
          value={newMessage}
          onChangeText={setNewMessage}
          style={styles.input}
          multiline
        />
        <TouchableOpacity onPress={sendMessage} style={styles.sendButton}>
          <Text style={{ color: 'white', fontWeight: 'bold' }}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  messageContainer: {
    marginBottom: 12,
    padding: 10,
    borderRadius: 12,
    maxWidth: '75%',
  },
  myMessage: {
    backgroundColor: '#0066CC',
    alignSelf: 'flex-end',
  },
  theirMessage: {
    backgroundColor: '#E2E8F0',
    alignSelf: 'flex-start',
  },
  myText: { color: 'white' },
  theirText: { color: 'black' },
  timestamp: {
    fontSize: 10,
    color: '#555',
    marginTop: 4,
    textAlign: 'right',
  },
  inputRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
    backgroundColor: 'white',
  },
  input: {
    flex: 1,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
  },
  sendButton: {
    backgroundColor: '#0066CC',
    borderRadius: 25,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
});
