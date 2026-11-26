import { router, useLocalSearchParams } from 'expo-router';
import { type ComponentRef, useEffect, useRef, useState } from 'react';
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
// Vai tanto no início quanto no fim do carregamento, para funcionar mesmo
// se a página demorar a terminar de carregar.
const WATCH_FOR_ITEMS = `
(function () {
  if (window.__dizpensaWatch) return;
  window.__dizpensaWatch = true;
  var sent = false;
  function check() {
    if (sent || !document.body) return;
    var text = document.body.innerText || '';
    if (/Qtde/i.test(text) && /Vl\\.?\\s*Total|Valor total/i.test(text)) {
      sent = true;
      window.ReactNativeWebView.postMessage(document.documentElement.outerHTML);
    }
  }
  setInterval(check, 800);
})();
true;
`;

// Usado pelo botão "Ler esta página", caso a leitura automática não dispare.
const SEND_PAGE = `window.ReactNativeWebView.postMessage(document.documentElement.outerHTML); true;`;

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
  const [progress, setProgress] = useState(0);
  const [slow, setSlow] = useState(false);
  const done = useRef(false);
  const webview = useRef<ComponentRef<typeof WebView>>(null);

  // Depois de um tempo, mostra o botão para ler a página manualmente.
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 15_000);
    return () => clearTimeout(timer);
  }, []);

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
      {progress < 1 ? (
        <View
          style={[styles.progress, { backgroundColor: theme.primary, width: `${Math.max(progress, 0.05) * 100}%` }]}
        />
      ) : null}
      <WebView
        ref={webview}
        source={{ uri: url }}
        style={styles.flex}
        injectedJavaScriptBeforeContentLoaded={WATCH_FOR_ITEMS}
        injectedJavaScript={WATCH_FOR_ITEMS}
        onMessage={onMessage}
        onLoadProgress={(e) => setProgress(e.nativeEvent.progress)}
        // A verificação da Cloudflare usa quadros internos (about:blank, blob:),
        // então qualquer origem pode carregar dentro da página; só a navegação
        // principal fica presa ao site da SEFAZ.
        originWhitelist={['*']}
        onShouldStartLoadWithRequest={(req) => req.isTopFrame === false || isAllowedPage(req.url)}
        setSupportMultipleWindows={false}
      />
      {slow ? (
        <View style={[styles.footer, { backgroundColor: theme.backgroundElement }]}>
          <AppText themeColor="textSecondary">A nota já apareceu na tela e nada aconteceu?</AppText>
          <Button
            title="Ler esta página"
            variant="secondary"
            onPress={() => webview.current?.injectJavaScript(SEND_PAGE)}
          />
        </View>
      ) : null}
    </View>
  );
}

function isAllowedPage(raw: string): boolean {
  if (!/^https?:/i.test(raw)) return true; // about:blank, blob:, data:
  try {
    const host = new URL(raw).hostname;
    return host.endsWith('fazenda.mg.gov.br') || host.endsWith('cloudflare.com');
  } catch {
    return false;
  }
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, padding: Spacing.three, justifyContent: 'center' },
  tip: { padding: Spacing.three },
  bold: { fontWeight: '700' },
  progress: { height: 3 },
  footer: { padding: Spacing.three, gap: Spacing.two },
});
