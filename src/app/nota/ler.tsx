import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Card, Screen, TextField } from '@/components/ui';
import { Radius } from '@/constants/theme';
import { useHousehold } from '@/lib/household';
import { isMgReceiptUrl, isReceiptSaved, sefazUrl } from '@/lib/nfce';

export default function ScanReceiptScreen() {
  const { household } = useHousehold();
  const [permission, requestPermission] = useCameraPermissions();
  const [error, setError] = useState<string | null>(null);
  const [manualUrl, setManualUrl] = useState('');
  const [showManual, setShowManual] = useState(false);
  // A câmera dispara várias leituras seguidas do mesmo QR; processamos só a primeira.
  const busy = useRef(false);

  async function handleUrl(url: string) {
    if (busy.current) return;
    busy.current = true;
    setError(null);
    if (!isMgReceiptUrl(url)) {
      setError('Esse QR code não é de uma nota fiscal de Minas Gerais.');
    } else if (await isReceiptSaved(url, household.id)) {
      setError('Essa nota já foi lançada na despensa.');
    } else {
      // A SEFAZ pede uma verificação anti-robô, então a nota é aberta no aparelho.
      router.replace({ pathname: '/nota/sefaz', params: { url: sefazUrl(url) } });
      return;
    }
    // Espera um pouco antes de aceitar outra leitura, para não repetir o mesmo erro.
    setTimeout(() => {
      busy.current = false;
    }, 2500);
  }

  return (
    <Screen edges={['bottom']}>
      {permission?.granted ? (
        <View style={styles.cameraBox}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={({ data }) => handleUrl(data)}
          />
          <View style={styles.frame} pointerEvents="none" />
        </View>
      ) : (
        <Card>
          <AppText>Para ler o QR code da nota, o app precisa usar a câmera.</AppText>
          <Button
            title={permission?.canAskAgain === false ? 'Câmera bloqueada nas configurações' : 'Permitir câmera'}
            onPress={requestPermission}
            disabled={permission?.canAskAgain === false}
          />
        </Card>
      )}

      <AppText themeColor="textSecondary" style={{ textAlign: 'center' }}>
        Aponte para o QR code no rodapé da nota (NFC-e de Minas Gerais).
      </AppText>

      {error ? (
        <Card>
          <AppText themeColor="danger">{error}</AppText>
        </Card>
      ) : null}

      {showManual ? (
        <Card>
          <TextField
            label="Link do QR code"
            value={manualUrl}
            onChangeText={setManualUrl}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="https://portalsped.fazenda.mg.gov.br/…"
          />
          <Button title="Ler nota" onPress={() => handleUrl(manualUrl)} disabled={!manualUrl.trim()} />
        </Card>
      ) : (
        <Button title="Colar o link da nota" variant="ghost" onPress={() => setShowManual(true)} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  cameraBox: {
    height: 340,
    borderRadius: Radius.large,
    overflow: 'hidden',
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    width: 220,
    height: 220,
    borderWidth: 3,
    borderColor: '#F2B544',
    borderRadius: Radius.medium,
  },
});
