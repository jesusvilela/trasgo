import { Tabs } from 'expo-router';
import { theme } from '../../src/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.muted,
        tabBarStyle: {
          backgroundColor: theme.colors.panel,
          borderTopColor: theme.colors.border,
        },
        sceneStyle: {
          backgroundColor: theme.colors.bg,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home / Quickstart' }} />
      <Tabs.Screen name="demos" options={{ title: 'Demos' }} />
      <Tabs.Screen name="tokens" options={{ title: 'Tokens' }} />
      <Tabs.Screen name="machines" options={{ title: 'Machines' }} />
      <Tabs.Screen name="status" options={{ title: 'Status' }} />
    </Tabs>
  );
}
