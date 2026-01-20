import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MessageSquare, Search, Clock, User, Stethoscope, ChevronRight, ArrowUpRight, Shield } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

interface ChatPreview {
  id: string;
  patientId: string;
  doctorId: string;
  patientName: string;
  doctorName: string;
  lastMessage: string | null;
  lastMessageTime: string | null;
  unreadCount: number;
}

export default function ChatsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [chats, setChats] = useState<ChatPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredChats, setFilteredChats] = useState<ChatPreview[]>([]);

  useEffect(() => {
    if (user) {
      loadChats();
    }
  }, [user]);

  useEffect(() => {
    if (searchQuery.trim()) {
      setFilteredChats(
        chats.filter(chat => 
          user?.role === 'doctor' 
            ? chat.patientName.toLowerCase().includes(searchQuery.toLowerCase())
            : chat.doctorName.toLowerCase().includes(searchQuery.toLowerCase())
        )
      );
    } else {
      setFilteredChats(chats);
    }
  }, [searchQuery, chats, user]);

  const loadChats = async () => {
    setLoading(true);
    try {
      if (user?.role === 'doctor') {
        // Get doctor ID
        const { data: doctorData } = await supabase
          .from('doctors')
          .select('id')
          .eq('user_id', user.id)
          .single();

        if (!doctorData) {
          setLoading(false);
          return;
        }

        // Get chats for doctor
        const { data: chatData, error } = await supabase
          .from('chats')
          .select(`
            id,
            doctor_id,
            patient_id,
            created_at,
            patients!inner (
              profiles!inner (
                full_name
              )
            )
          `)
          .eq('doctor_id', doctorData.id)
          .order('created_at', { ascending: false });

        if (error) throw error;

        // Get last message for each chat
        const chatsWithMessages = await Promise.all(
          (chatData || []).map(async (chat) => {
            const { data: messages } = await supabase
              .from('messages')
              .select('*')
              .eq('chat_id', chat.id)
              .order('created_at', { ascending: false })
              .limit(1);

            const lastMessage = messages && messages.length > 0 ? messages[0] : null;

            return {
              id: chat.id,
              patientId: chat.patient_id,
              doctorId: chat.doctor_id,
              patientName: chat.patients.profiles.full_name,
              doctorName: user.full_name,
              lastMessage: lastMessage?.message || null,
              lastMessageTime: lastMessage?.created_at || chat.created_at,
              unreadCount: 0, // This would need a proper implementation
            };
          })
        );

        setChats(chatsWithMessages);
      } else {
        // Get patient ID
        const { data: patientData } = await supabase
          .from('patients')
          .select('id')
          .eq('user_id', user.id)
          .single();

        if (!patientData) {
          setLoading(false);
          return;
        }

        // Get chats for patient
        const { data: chatData, error } = await supabase
          .from('chats')
          .select(`
            id,
            doctor_id,
            patient_id,
            created_at,
            doctors!inner (
              profiles!inner (
                full_name
              )
            )
          `)
          .eq('patient_id', patientData.id)
          .order('created_at', { ascending: false });

        if (error) throw error;

        // Get last message for each chat
        const chatsWithMessages = await Promise.all(
          (chatData || []).map(async (chat) => {
            const { data: messages } = await supabase
              .from('messages')
              .select('*')
              .eq('chat_id', chat.id)
              .order('created_at', { ascending: false })
              .limit(1);

            const lastMessage = messages && messages.length > 0 ? messages[0] : null;

            return {
              id: chat.id,
              patientId: chat.patient_id,
              doctorId: chat.doctor_id,
              patientName: user.full_name,
              doctorName: chat.doctors.profiles.full_name,
              lastMessage: lastMessage?.message || null,
              lastMessageTime: lastMessage?.created_at || chat.created_at,
              unreadCount: 0, // This would need a proper implementation
            };
          })
        );

        setChats(chatsWithMessages);
      }
    } catch (error) {
      console.error('Error loading chats:', error);
    } finally {
      setLoading(false);
    }
  };

  const navigateToChat = (patientId: string) => {
    router.push(`/chat/${patientId}`);
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const renderChatItem = ({ item }: { item: ChatPreview }) => {
    const isDoctor = user?.role === 'doctor';
    const name = isDoctor ? item.patientName : item.doctorName;
    const initial = name.charAt(0).toUpperCase();
    
    return (
      <TouchableOpacity
        style={styles.chatItem}
        onPress={() => navigateToChat(item.patientId)}
        activeOpacity={0.7}
      >
        <View style={styles.avatarContainer}>
          <View style={[styles.avatar, isDoctor ? styles.patientAvatar : styles.doctorAvatar]}>
            {isDoctor ? (
              <User size={24} color="#0066CC" />
            ) : (
              <Stethoscope size={24} color="#4ECDC4" />
            )}
          </View>
          {item.unreadCount > 0 && (
            <View style={styles.badgeContainer}>
              <Text style={styles.badgeText}>{item.unreadCount}</Text>
            </View>
          )}
        </View>
        
        <View style={styles.chatContent}>
          <View style={styles.chatHeader}>
            <Text style={styles.chatName}>{name}</Text>
            <Text style={styles.chatTime}>
              {item.lastMessageTime ? formatTime(item.lastMessageTime) : ''}
            </Text>
          </View>
          
          <View style={styles.chatPreview}>
            <Text style={styles.chatMessage} numberOfLines={1}>
              {item.lastMessage || 'Start a conversation...'}
            </Text>
            <ChevronRight size={16} color="#CBD5E1" />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyComponent = () => (
    <View style={styles.emptyContainer}>
      <MessageSquare size={64} color="#CBD5E1" />
      <Text style={styles.emptyTitle}>No conversations yet</Text>
      <Text style={styles.emptyText}>
        {user?.role === 'doctor' 
          ? 'Your patient conversations will appear here'
          : 'Start a conversation with your healthcare provider'}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <MessageSquare size={24} color="#0066CC" />
          <Text style={styles.headerTitle}>Conversations</Text>
        </View>
        <TouchableOpacity style={styles.refreshButton} onPress={loadChats}>
          <Clock size={20} color="#0066CC" />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Search size={20} color="#64748B" />
          <TextInput
            style={styles.searchInput}
            placeholder={user?.role === 'doctor' ? "Search patients..." : "Search doctors..."}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* Chat List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0066CC" />
          <Text style={styles.loadingText}>Loading conversations...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredChats}
          renderItem={renderChatItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.chatList}
          ListEmptyComponent={renderEmptyComponent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Security Notice */}
      <View style={styles.securityNotice}>
        <Shield size={16} color="#64748B" />
        <Text style={styles.securityText}>
          End-to-end encrypted conversations
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFB',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EBF4FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1E293B',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#64748B',
  },
  chatList: {
    padding: 16,
    flexGrow: 1,
  },
  chatItem: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  patientAvatar: {
    backgroundColor: '#EBF4FF',
  },
  doctorAvatar: {
    backgroundColor: '#D1FAE5',
  },
  badgeContainer: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#DC3545',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  badgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  chatContent: {
    flex: 1,
    justifyContent: 'center',
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  chatName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  chatTime: {
    fontSize: 12,
    color: '#94A3B8',
  },
  chatPreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chatMessage: {
    fontSize: 14,
    color: '#64748B',
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
    gap: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1E293B',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
  },
  securityNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: 'white',
  },
  securityText: {
    fontSize: 12,
    color: '#64748B',
  },
});