import React from 'react';
import { View, StyleSheet, StatusBar, Text } from 'react-native';
import { AIChat } from '@/components/AIChat';
import { useAuth } from '@/context/AuthContext';

export default function DemoAIChatScreen() {
  const { user } = useAuth();

  if (!user) {
    return (
      <View style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.text}>Please log in to use the AI assistant</Text>
        </View>
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
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: 16,
    color: '#333',
  },
});
