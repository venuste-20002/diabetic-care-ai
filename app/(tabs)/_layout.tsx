import { Tabs } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { Users, MessageSquare, Database, ChartBar as BarChart3 , House as Home, Activity, MapPin } from 'lucide-react-native';

import { View } from 'react-native';

export default function TabLayout() {
  const { user, loading } = useAuth();

  // Render a loading state or a placeholder while auth is resolving
  if (loading) {
    return <View style={{ flex: 1, backgroundColor: 'white' }} />;
  }

  // The AuthProvider will handle redirection if the user is not authenticated.
  // This component should focus solely on rendering the tab layout.
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: 'white',
          borderTopWidth: 1,
          borderTopColor: '#E2E8F0',
          paddingTop: 8,
          paddingBottom: 8,
          height: 70,
        },
        tabBarActiveTintColor: '#0066CC',
        tabBarInactiveTintColor: '#64748B',
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
          marginTop: 4,
        },
      }}
    >
      {user?.role === 'doctor' ? (
        <>
          <Tabs.Screen
            name="index"
            options={{
              title: 'Analytics',
              tabBarIcon: ({ size, color }) => <BarChart3 size={size} color={color} />,
            }}
          />
          
          <Tabs.Screen
            name="patients"
            options={{
              title: 'Patients',
              tabBarIcon: ({ size, color }) => <Users size={size} color={color} />,
            }}
          />

          <Tabs.Screen
            name="research"
            options={{
              title: 'Research Portal',
              tabBarIcon: ({ size, color }) => <Database size={size} color={color} />,
            }}
          />

          <Tabs.Screen
            name="chats"
            options={{
              title: 'Chats',
              tabBarIcon: ({ size, color }) => <MessageSquare size={size} color={color} />,
            }}
          />
        </>
      ) : (
        <>
          <Tabs.Screen
            name="index"
            options={{
              title: 'Home',
              tabBarIcon: ({ size, color }) => <Home size={size} color={color} />,
            }}
          />
          
          <Tabs.Screen
            name="assessment"
            options={{
              title: 'Health Check',
              tabBarIcon: ({ size, color }) => <Activity size={size} color={color} />,
              href: user?.role === 'patient' ? '/assessment' : null,
            }}
          />

          <Tabs.Screen
            name="location"
            options={{
              title: 'Health Map',
              tabBarIcon: ({ size, color }) => <MapPin size={size} color={color} />,
            }}
          />

          <Tabs.Screen
            name="chats"
            options={{
              title: 'Chats',
              tabBarIcon: ({ size, color }) => <MessageSquare size={size} color={color} />,
            }}
          />
        </>
      )}
      
      {/* Hidden screens that don't appear in tabs */}
      <Tabs.Screen
        name="patients"
        options={{
          href: null, // Hide from tab bar for patients
        }}
      />
      <Tabs.Screen
        name="research"
        options={{
          href: null, // Hide from tab bar for patients 
        }}
      />
      <Tabs.Screen
        name="diabetes-dashboard"
        options={{
          href: null, // Hide from tab bar
        }}
      />
      <Tabs.Screen
        name="assessment"
        options={{
          href: null, // Hide from tab bar for doctors
        }}
      />
      <Tabs.Screen
        name="AssessmentDetailsScreen"
        options={{
          href: null, // Hide from tab bar
        }}
      />
      <Tabs.Screen
        name="ResultsScreen"
        options={{
          href: null, // Hide from tab bar
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          href: null, // Hide from tab bar but keep the screen
        }}
      />
    </Tabs>
  );
}
