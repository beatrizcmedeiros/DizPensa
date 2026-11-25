import { router } from 'expo-router';

import { OptionSheet } from '@/components/ui';

/** "Adicionar": uma porta só para as duas formas de colocar produtos na despensa. */
export function AddSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <OptionSheet
      visible={visible}
      title="Adicionar à despensa"
      onClose={onClose}
      onSelect={(key) => router.push(key === 'nota' ? '/nota/ler' : '/produto/novo')}
      options={[
        {
          key: 'nota',
          label: 'Ler nota fiscal',
          icon: 'qr_code_scanner',
          description: 'Aponte a câmera para o QR code da nota do mercado',
        },
        {
          key: 'manual',
          label: 'Digitar produto',
          icon: 'edit_note',
          description: 'Para o que veio sem nota ou já estava em casa',
        },
      ]}
    />
  );
}
