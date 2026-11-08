# DizPensa

App Android (React Native + Expo) para controlar a despensa da casa, compartilhada entre os moradores e funcionando offline.

- **App:** Expo SDK 58, Expo Router, TypeScript
- **Banco local:** SQLite via PowerSync (funciona sem internet)
- **Nuvem:** Supabase (login, Postgres, permissões) + PowerSync (sincronização)

## Fases

| Fase | Conteúdo | Situação |
|---|---|---|
| 1 | Login, casa compartilhada, despensa, cadastro manual, baixa, categorias, duração | **feita** |
| 2 | Leitura do QR da NFC-e (MG), padronização de nomes com IA, tela de revisão, aba Compras | **feita** (falta testar com nota real) |
| 3 | Sair da casa, remover membro, aviso ao sair com alterações não enviadas | **feita** |
| 4 | Lista de compras, relatórios com filtros, histórico de preço | **feita** |
| 5 | Publicação na Play Store | a fazer |

## Leitura da nota fiscal

1. O app lê o QR code (ou o link colado) e chama a função `nfce-import` no Supabase.
2. A função busca a página da SEFAZ-MG, extrai loja, data, total e itens ([parse.ts](supabase/functions/nfce-import/parse.ts)).
3. Para cada item, procura como a casa classificou essa mesma descrição antes (“memória”). Só os itens novos vão para a IA ([normalize.ts](supabase/functions/nfce-import/normalize.ts)), que devolve nome genérico, marca, categoria e se é por peso.
4. O app mostra a revisão; ao confirmar, grava compra, itens, produtos, lotes e entradas no banco local.

A IA usa o Gemini (modelo `gemini-3.5-flash-lite`, definido em `normalize.ts`) e precisa do segredo `GEMINI_API_KEY` na função (Supabase > Edge Functions > Secrets). Sem ele a leitura funciona, mas os nomes vêm como estão na nota.

## Como as coisas funcionam

- **Produto** é o item genérico ("Arroz branco"). A **marca** fica numa variante, então marcas diferentes se agrupam no mesmo produto.
- Produtos são contados **por embalagem** ou **por peso (kg)**, escolhido no cadastro.
- Cada entrada cria um **lote**. A baixa consome o lote mais antigo primeiro. Quando um lote zera, a data é registrada e o app calcula **quanto tempo durou**.
- Tudo é gravado primeiro no aparelho. O PowerSync envia para o Supabase quando há internet e traz as alterações das outras pessoas da casa.

## Estrutura

```
src/app/                 telas (cada arquivo é uma rota)
  _layout.tsx            decide entre login / criar casa / app
  (tabs)/index.tsx       despensa
  (tabs)/lista.tsx       lista de compras
  (tabs)/compras.tsx     compras lançadas + ler nota
  (tabs)/relatorios.tsx  gastos, mais comprados, consumo
  (tabs)/casa.tsx        casa, convite, membros, sair
  nota/ler.tsx           câmera / link do QR code
  nota/revisar.tsx       revisão dos itens da nota
  compra/[id].tsx        detalhe de uma compra
  produto/novo.tsx       cadastro manual / entrada no estoque
  produto/[id].tsx       detalhe, baixa, duração, histórico de preço
  categorias.tsx
src/lib/
  powersync/schema.ts    tabelas do banco local
  powersync/connector.ts envio das alterações para o Supabase
  stock.ts               regras de entrada e baixa
  nfce.ts                leitura e gravação da nota
  shopping.ts            lista de compras
supabase/migrations/     SQL do banco na nuvem
supabase/functions/      função que lê a nota (roda no Supabase, em Deno)
powersync/sync-config.yaml  o que cada pessoa recebe na sincronização
```

## Configuração (uma vez)

### 1. Node 24
O Expo 58 exige Node 22.13+ ou 24. Você tem o 24 instalado no nvm:
```bash
nvm use 24.21.0
```

### 2. Supabase
1. Crie um projeto em https://supabase.com (região São Paulo).
2. Abra o **SQL Editor**, cole o conteúdo de `supabase/migrations/0001_inicial.sql` e rode.
3. Crie o usuário que o PowerSync usa para ler o banco (troque a senha):
   ```sql
   create role powersync_role with replication bypassrls login password 'TROQUE_ESTA_SENHA';
   grant select on all tables in schema public to powersync_role;
   ```
4. Em **Authentication > Sign In / Providers > Email**, deixe o login por e-mail ligado.
   Durante o desenvolvimento, desligar **Confirm email** facilita os testes.

### 3. PowerSync
1. Crie uma conta em https://www.powersync.com e uma instância.
2. Conecte ao Postgres do Supabase (Supabase > **Connect** > connection string direta), usando o usuário `powersync_role`.
3. Ative a autenticação do **Supabase Auth** na instância.
4. Cole o conteúdo de `powersync/sync-config.yaml` na configuração de Sync Streams e faça o deploy.

### 4. Variáveis de ambiente
Copie `.env.example` para `.env` e preencha a URL e a publishable key do Supabase e a URL da instância do PowerSync.

### 5. Rodar no Android
O PowerSync usa código nativo, então **o app não roda no Expo Go**. É preciso um *development build*:

- **Celular por USB ou emulador** (você já tem o Android SDK):
  ```bash
  npx expo run:android
  ```
  Se reclamar do SDK, defina `ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk`.
- **Na nuvem do Expo** (gera um APK para instalar no celular):
  ```bash
  npx eas-cli@latest build --profile development --platform android
  ```

Depois do primeiro build, `npx expo start` basta para continuar desenvolvendo.

## Comandos úteis
```bash
npx tsc --noEmit   # checa os tipos
npx expo-doctor    # checa dependências
```
