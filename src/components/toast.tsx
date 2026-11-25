import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BottomTabInset, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ToastOptions = {
  message: string;
  /** Ex.: "Desfazer" */
  actionLabel?: string;
  onAction?: () => void;
};

const ToastContext = createContext<(t: ToastOptions) => void>(() => {});

/** Aviso curto no rodapé, com ação opcional (ex.: desfazer). Some sozinho. */
export function ToastProvider({ children }: PropsWithChildren) {
  const theme = useTheme();
  const [toast, setToast] = useState<(ToastOptions & { id: number }) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((t: ToastOptions) => {
    setToast({ ...t, id: Date.now() });
  }, []);

  useEffect(() => {
    if (!toast) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 5000);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [toast]);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast ? (
        <View
          accessibilityLiveRegion="polite"
          pointerEvents="box-none"
          style={[styles.wrap, { bottom: BottomTabInset + Spacing.three }]}>
          <View style={[styles.toast, { backgroundColor: theme.toast }]}>
            <Text style={[styles.message, { color: theme.onToast }]} numberOfLines={2}>
              {toast.message}
            </Text>
            {toast.actionLabel && toast.onAction ? (
              <Pressable
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => {
                  toast.onAction?.();
                  setToast(null);
                }}
                style={styles.action}>
                <Text style={[styles.actionText, { color: theme.accent }]}>{toast.actionLabel}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: Spacing.three, right: Spacing.three },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 52,
    borderRadius: Radius.medium,
    paddingLeft: Spacing.three,
    paddingRight: Spacing.one,
    elevation: 6,
  },
  message: { flex: 1, fontSize: 15 },
  action: { minHeight: 44, paddingHorizontal: Spacing.three, justifyContent: 'center' },
  actionText: { fontSize: 15, fontWeight: '700' },
});
