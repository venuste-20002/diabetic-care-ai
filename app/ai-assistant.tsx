import React from 'react';
import { View, StyleSheet, StatusBar, Text } from 'react-native';
import { AIChat } from '@/components/AIChat';
import { useAuth } from '@/context/AuthContext';

export default function AIAssistantScreen() {
  const { user } = useAuth();

  if (!user) {
    return (
      <View style={styles.container}>
        <Text>Please log in to use the AI assistant</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFB" />
      <AIChat userId={user.id} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFB',
  },
});
