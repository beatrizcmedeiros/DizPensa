import { PowerSyncContext } from '@powersync/react-native';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';
import { HouseholdProvider, useCurrentHouseholdQuery } from '@/lib/household';
import { db } from '@/lib/powersync/db';
import { SessionProvider, useSession } from '@/lib/session';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const scheme = useColorScheme();
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  return (
    <PowerSyncContext.Provider value={db}>
      <SessionProvider>
        <ThemeProvider
          value={{
            ...base,
            colors: {
              ...base.colors,
              primary: colors.primary,
              background: colors.background,
              card: colors.background,
              text: colors.text,
              border: colors.border,
            },
          }}>
          <RootNavigator />
        </ThemeProvider>
      </SessionProvider>
    </PowerSyncContext.Provider>
  );
}

function RootNavigator() {
  const { session, loading } = useSession();
  const { household, isLoading: householdLoading } = useCurrentHouseholdQuery();

  const ready = !loading && !householdLoading;
  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);
  if (!ready) return null;

  const signedIn = !!session;
  const hasHousehold = signedIn && !!household;

  return (
    <HouseholdProvider
      value={hasHousehold && session ? { household, userId: session.user.id } : null}>
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="login" />
        <Stack.Screen name="cadastro" />
      </Stack.Protected>

      <Stack.Protected guard={signedIn && !hasHousehold}>
        <Stack.Screen name="casa-nova" />
      </Stack.Protected>

      <Stack.Protected guard={hasHousehold}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="produto/novo" options={{ headerShown: true, title: 'Adicionar produto' }} />
        <Stack.Screen name="produto/[id]" options={{ headerShown: true, title: 'Produto' }} />
        <Stack.Screen name="categorias" options={{ headerShown: true, title: 'Categorias' }} />
      </Stack.Protected>
    </Stack>
    </HouseholdProvider>
  );
}
