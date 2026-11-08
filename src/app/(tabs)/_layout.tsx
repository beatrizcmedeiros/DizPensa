import { NativeTabs } from 'expo-router/native-tabs';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';

export default function TabsLayout() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundSelected}
      labelStyle={{ selected: { color: colors.text } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Despensa</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon md="kitchen" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="lista">
        <NativeTabs.Trigger.Label>Lista</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon md="checklist" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="compras">
        <NativeTabs.Trigger.Label>Compras</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon md="receipt_long" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="relatorios">
        <NativeTabs.Trigger.Label>Relatórios</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon md="bar_chart" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="casa">
        <NativeTabs.Trigger.Label>Casa</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon md="home" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
