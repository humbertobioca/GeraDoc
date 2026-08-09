# GeraDoc

App de desktop (Electron) para montar documentos de teste manual: captura de tela
com marcações, template totalmente editável, preview em folhas A4 e exportação
para Word e PDF.

## A tecla PrintScreen no Windows 11

De fábrica, o Windows 11 reserva a tecla **PrintScreen** para a Ferramenta de
Captura. Enquanto isso estiver ligado, nenhum outro programa recebe a tecla — é
o mesmo motivo pelo qual o Lightshot pede essa configuração.

O GeraDoc detecta isso ao abrir e mostra uma faixa com duas saídas:

- **Liberar a tecla** — grava `PrintScreenKeyForSnippingEnabled = 0` em `HKCU`
  (não precisa de admin). Exige logoff ou reinício do Windows para valer.
- **Usar Ctrl+Shift+X** — troca o atalho e funciona na hora.

Equivalente manual: Configurações → Acessibilidade → Teclado → "Use o botão
Print screen para abrir a captura de tela".

## Desenvolvimento

```bash
npm install
npm run dev        # Vite + Electron com recarga automática
```

Outros comandos:

| Comando | O que faz |
| --- | --- |
| `npm start` | Compila e roda o app como em produção |
| `npm run dev:web` | Só a interface no navegador, em `localhost:5173`, útil para depurar (sem captura de tela nem exportação) |
| `npm run icon` | Regera `build/icon.ico` e `build/icon.png` a partir de `build/icon.svg` |
| `npm run dist` | Gera o instalador e a versão portátil em `release/` |

## Gerando os executáveis

```bash
npm run dist
```

Produz em `release/`:

- **`Gerador de Evidencias-<versão>-Instalador.exe`** — instalação por usuário,
  em `%LOCALAPPDATA%\Programs`, com atalhos no menu Iniciar e na área de
  trabalho. **Não pede senha de administrador.**
- **`Gerador de Evidencias-<versão>-Portatil.exe`** — executa direto, sem
  instalar nada.

### Se o build falhar com "Cannot create symbolic link"

O `electron-builder` baixa um pacote com symlinks do macOS que o Windows só
extrai com privilégio elevado. Como nada disso é usado aqui, basta extrair o
pacote manualmente sem a pasta `darwin` — uma vez só, por máquina:

```bash
curl -L -o "$LOCALAPPDATA/electron-builder/Cache/winCodeSign/winCodeSign-2.6.0.7z" https://github.com/electron-userland/electron-builder-binaries/releases/download/winCodeSign-2.6.0/winCodeSign-2.6.0.7z
```

```bash
./node_modules/7zip-bin/win/x64/7za.exe x "$LOCALAPPDATA/electron-builder/Cache/winCodeSign/winCodeSign-2.6.0.7z" "-o$LOCALAPPDATA/electron-builder/Cache/winCodeSign/winCodeSign-2.6.0" "-xr!darwin" -y
```

Depois `npm run dist` roda normalmente.

## Distribuindo para outras máquinas

Basta copiar o `.exe` desejado. Requisitos na máquina de destino: Windows 10 ou
11, 64 bits. Não precisa de Node.js nem de permissão de administrador.

Sem assinatura digital, a primeira execução mostra a tela azul "O Windows
protegeu o computador" — clique em **Mais informações → Executar assim mesmo**.
Veja a seção seguinte para eliminar esse aviso.

## Assinatura digital

O `electron-builder` assina automaticamente quando estas duas variáveis de
ambiente existem — não é preciso mexer no `package.json`:

```bash
CSC_LINK=build/certificado.pfx CSC_KEY_PASSWORD=sua-senha npm run dist
```

### Opção A — certificado autoassinado (grátis, uso interno)

```bash
powershell -ExecutionPolicy Bypass -File tools/gerar-certificado.ps1 -Senha sua-senha
```

Não pede administrador; o certificado fica em `Cert:\CurrentUser\My` e o `.pfx`
em `build/`. **Continua dando aviso do SmartScreen** em qualquer máquina que não
confie nesse certificado — para confiar, ele precisa ser importado em
"Autoridades de Certificação Raiz Confiáveis" na máquina de destino (aí sim com
admin, ou por política de domínio). Serve para parque de máquinas gerenciado.

### Opção B — certificado de uma autoridade certificadora (pago)

Elimina o aviso de verdade. Emissores comuns: Sectigo, DigiCert, Certum
(o mais barato costuma ser o Certum Open Source). Desde 2023 a chave privada
precisa ficar em token físico ou HSM na nuvem, o que complica a automação.

- **OV (Organization Validation)**: mais barato; o SmartScreen ainda pode
  reclamar até o instalador ganhar reputação por número de downloads.
- **EV (Extended Validation)**: reputação imediata, sem período de carência.

### Opção C — Azure Trusted Signing (recomendada hoje)

Serviço da Microsoft, na casa de US$ 10/mês, sem token físico e com reputação
imediata no SmartScreen. Exige uma conta Azure e validação da identidade.
No `package.json`, em `build.win`:

```json
"azureSignOptions": {
  "publisherName": "Seu Nome",
  "endpoint": "https://wus2.codesigning.azure.net",
  "certificateProfileName": "seu-perfil",
  "codeSigningAccountName": "sua-conta"
}
```

Nunca versione o `.pfx` nem a senha — o `.gitignore` já bloqueia `*.pfx`.

## Arquivos e preferências

Os projetos usam a extensão própria **`.evid`**, registrada no Windows pelo
instalador (só em `HKCU`, sem admin): dois cliques no arquivo abrem o app já com
o projeto carregado, e o ícone do app aparece no Explorer.

Comportamento de salvamento:

- **Antes de escolher uma pasta**, cada alteração vai para um rascunho temporário
  em `drafts/`, um arquivo por janela. Se o app fechar sem querer, o trabalho
  reaparece na próxima abertura.
- **Depois do primeiro Salvar**, o arquivo escolhido passa a ser a fonte da
  verdade: toda alteração é gravada nele automaticamente (~1s após a última
  mudança) e o rascunho é descartado. O indicador na barra de título alterna
  entre "salvando…" e "salvo".
- `Ctrl+S` salva; `Ctrl+Shift+S` é **Salvar como…**.
- A primeira janela **reabre o último documento** automaticamente.
- Os diálogos de abrir, salvar, **PDF e Word** já começam na pasta do documento
  aberto.

## Várias janelas

Dá para manter vários documentos abertos ao mesmo tempo, um por janela.
**Novo** e **Abrir** perguntam se a ação vale para a janela atual ou para uma
nova, com a opção **"Não perguntar mais"**. Depois de marcada, a escolha vira
padrão — para voltar a perguntar, apague `askOnNew`/`askOnOpen` do `prefs.json`.

Um `.evid` aberto pelo Explorer sempre ganha a própria janela.

## Atualização automática

O app checa por atualizações 6 segundos após abrir e também pelo botão **⭯** na
barra superior. **Nada é baixado sem você mandar**: primeiro aparece um aviso com
a versão nova, você clica em *Baixar agora*, acompanha o progresso e só então
*Reiniciar e atualizar*.

Ao instalar, o GeraDoc grava tudo que está aberto — documentos com arquivo vão
para o arquivo, os sem arquivo ficam no rascunho — anota quais janelas estavam
abertas, instala e **reabre as mesmas janelas** com os mesmos documentos.

Como o instalador é por usuário, a atualização também **não pede administrador**.

### Publicando uma versão nova

As releases saem do **GitHub Releases** deste repositório. O jeito recomendado é
deixar o GitHub compilar:

```bash
npm version 1.1.0
```

```bash
git push origin main --follow-tags
```

O `npm version` sobe o número no `package.json`, cria o commit e a tag `v1.1.0`.
Ao chegar a tag, o workflow [release.yml](.github/workflows/release.yml) compila
no Windows e publica na aba **Releases**: o instalador, o portátil, o
`latest.yml` e o `.blockmap`.

É o `latest.yml` que o app consulta para saber se há versão nova, e o `blockmap`
que permite baixar só o que mudou em vez dos 80 MB inteiros.

A release nasce como **rascunho**? Não — sai publicada direto. Para revisar antes,
troque `releaseType` para `draft` em `build.publish` no `package.json` e clique
em "Publish release" na interface do GitHub quando estiver pronto.

O workflow confere se a tag bate com a versão do `package.json` e falha cedo se
estiverem diferentes.

### Publicando da sua máquina, sem o GitHub Actions

Precisa de um token com escopo `repo`
([criar aqui](https://github.com/settings/tokens/new?scopes=repo)):

```bash
GH_TOKEN=seu_token npm run release
```

Nunca coloque o token no `package.json` nem em qualquer arquivo do repositório —
use variável de ambiente.

### Outros destinos

Se um dia precisar sair do GitHub, troque `build.publish` no `package.json`:

- **Servidor HTTP interno / IIS / nginx** —
  `{ "provider": "generic", "url": "https://servidor/geradoc/" }`. Basta uma
  pasta servindo `latest.yml`, o instalador e o blockmap.
- **Amazon S3 / Azure Blob** — `"provider": "s3"` ou `"azureBlob"`.

Para apontar outro endereço sem recompilar, preencha `updateFeedUrl` no
`prefs.json`; ele tem prioridade sobre o `package.json`.

### Limites que valem saber

- A checagem só funciona **na versão instalada**. Em desenvolvimento e no
  portátil ela não roda — o portátil não tem como se substituir sozinho.
- Sem assinatura digital, cada atualização reexibe o aviso do SmartScreen.
- Se o servidor estiver fora do ar, a checagem falha em silêncio e o app abre
  normalmente.

## Preferências

Guardadas em `%APPDATA%\GeraDoc\prefs.json`: largura da barra lateral, zoom do
preview, aba ativa, atalho de captura, último documento, últimas pastas usadas,
posição e tamanho da janela, e as escolhas de "Novo/Abrir".

Também ficam nessa pasta os rascunhos e os templates salvos. Desinstalar o app
**não apaga** nada disso.
