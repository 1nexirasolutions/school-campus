import React from 'react';
import { Stack } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';

export default function AppLayout() {
  const { user } = useAuth();

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="dashboard" />
      <Stack.Screen name="attendance" />
      <Stack.Screen name="timetable" />
      <Stack.Screen name="assignments" />
      <Stack.Screen name="marks" />
      <Stack.Screen name="fees" />
      <Stack.Screen name="leave" />
      <Stack.Screen name="users" />
      <Stack.Screen name="classes" />
      <Stack.Screen name="profile" />
    </Stack>
  );
}
