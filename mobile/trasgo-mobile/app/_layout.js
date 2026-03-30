import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BridgeProvider } from '../src/bridge';
import { theme } from '../src/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.colors.bg }}>
        <BridgeProvider>
          <StatusBar style="light" />
          <Stack screenOptions={{ headerShown: false }} />
        </BridgeProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
