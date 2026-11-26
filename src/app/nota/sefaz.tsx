import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { AppText, Button, Card, Loading } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useHousehold } from '@/lib/household';
import { fetchReceipt, isMgReceiptUrl, ReceiptError, setPendingReceipt } from '@/lib/nfce';

// Roda dentro da página da SEFAZ: quando os itens da nota aparecem,
// manda o HTML da página para o app. Não clica em nada nem resolve a
// verificação anti-robô; isso fica com a pessoa, se a SEFAZ pedir.
const WATCH_FOR_ITEMS = `
(function () {
  var sent = false;
  function check() {
    if (sent) return;
    var text = document.body ? document.body.innerText : '';
    if (/Qtde/i.test(text) && /Vl\\.?\\s*Total|Valor total/i.test(text)) {
      sent = true;
      window.ReactNativeWebView.postMessage(document.documentElement.outerHTML);
    }
  }
  setInterval(check, 800);
  check();
})();
true;
`;

/**
 * Abre a consulta da NFC-e no site da SEFAZ de MG. Desde 2026 o site pede uma
 * verificação anti-robô (Cloudflare) antes de mostrar a nota, então a leitura
 * precisa acontecer no aparelho, com a pessoa passando pela verificação.
 */
export default function SefazScreen() {
  const theme = useTheme();
  const { url } = useLocalSearchParams<{ url: string }>();
  const { household } = useHousehold();
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const done = useRef(false);

  async function onMessage(event: WebViewMessageEvent) {
    if (done.current || !url) return;
    done.current = true;
    setReading(true);
    try {
      const receipt = await fetchReceipt(url, household.id, event.nativeEvent.data);
      setPendingReceipt(receipt);
      router.replace('/nota/revisar');
    } catch (e) {
      setError(e instanceof ReceiptError ? e.message : 'Não foi possível ler a nota.');
      setReading(false);
    }
  }

  if (!url || !isMgReceiptUrl(url)) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Card>
          <AppText themeColor="danger">Esse QR code não é de uma nota fiscal de Minas Gerais.</AppText>
          <Button title="Voltar" variant="secondary" onPress={() => router.back()} />
        </Card>
      </View>
    );
  }

  if (reading) {
    return <Loading message="Organizando os produtos da nota…" />;
  }

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Card>
          <AppText themeColor="danger">{error}</AppText>
          <Button title="Voltar" variant="secondary" onPress={() => router.back()} />
        </Card>
      </View>
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: theme.background }]}>
      <View style={[styles.tip, { backgroundColor: theme.backgroundElement }]}>
        <AppText>
          Se o site pedir, marque “Confirme que é humano” e toque em <AppText style={styles.bold}>Visualizar</AppText>.
          Quando a nota aparecer, o app lê os itens sozinho.
        </AppText>
      </View>
      <WebView
        source={{ uri: url }}
        style={styles.flex}
        injectedJavaScript={WATCH_FOR_ITEMS}
        onMessage={onMessage}
        // Só deixa navegar no site da SEFAZ e na verificação da Cloudflare.
        originWhitelist={['https://*']}
        onShouldStartLoadWithRequest={(req) => isAllowedPage(req.url)}
        setSupportMultipleWindows={false}
        startInLoadingState
      />
    </View>
  );
}

function isAllowedPage(raw: string): boolean {
  try {
    const host = new URL(raw).hostname;
    return (
      host.endsWith('fazenda.mg.gov.br') || host === 'challenges.cloudflare.com' || raw === 'about:blank'
    );
  } catch {
    return raw === 'about:blank';
  }
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, padding: Spacing.three, justifyContent: 'center' },
  tip: { padding: Spacing.three },
  bold: { fontWeight: '700' },
});
