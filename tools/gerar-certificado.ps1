<#
.SYNOPSIS
  Cria um certificado de assinatura de codigo AUTOASSINADO e exporta um .pfx.

.DESCRIPTION
  Serve para distribuicao interna, onde voce controla as maquinas de destino.
  NAO remove o aviso do SmartScreen em maquinas que nao confiam neste
  certificado -- para isso e preciso um certificado de uma autoridade
  certificadora reconhecida (veja o README).

  Nao precisa de permissao de administrador: o certificado vai para o
  repositorio do proprio usuario (Cert:\CurrentUser\My).

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File tools\gerar-certificado.ps1 -Senha "minhasenha"
#>
param(
  [string]$Nome = 'Humberto',
  [Parameter(Mandatory = $true)][string]$Senha,
  [int]$AnosDeValidade = 3,
  [string]$Saida = 'build\certificado.pfx'
)

$ErrorActionPreference = 'Stop'

$raiz = Split-Path -Parent $PSScriptRoot
$destino = Join-Path $raiz $Saida
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $destino) | Out-Null

Write-Host "Criando certificado para '$Nome' com validade de $AnosDeValidade anos..."

$cert = New-SelfSignedCertificate `
  -Type CodeSigningCert `
  -Subject "CN=$Nome" `
  -KeyUsage DigitalSignature `
  -KeyAlgorithm RSA `
  -KeyLength 2048 `
  -HashAlgorithm SHA256 `
  -CertStoreLocation 'Cert:\CurrentUser\My' `
  -NotAfter (Get-Date).AddYears($AnosDeValidade)

$pwd = ConvertTo-SecureString -String $Senha -Force -AsPlainText
Export-PfxCertificate -Cert $cert -FilePath $destino -Password $pwd | Out-Null

Write-Host ""
Write-Host "Certificado criado."
Write-Host "  Thumbprint: $($cert.Thumbprint)"
Write-Host "  Arquivo:    $destino"
Write-Host ""
Write-Host "Para assinar o build, defina as variaveis e rode 'npm run dist':"
Write-Host "  `$env:CSC_LINK = '$destino'"
Write-Host "  `$env:CSC_KEY_PASSWORD = '<sua senha>'"
Write-Host "  npm run dist"
Write-Host ""
Write-Host "IMPORTANTE: nao versione o .pfx nem a senha." -ForegroundColor Yellow
Write-Host "Para que as maquinas de destino confiem neste certificado, ele precisa"
Write-Host "ser importado em 'Autoridades de Certificacao Raiz Confiaveis' nelas"
Write-Host "(isso exige admin na maquina de destino, ou politica de dominio)."
