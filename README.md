# URBAN Roleplay V5

Protótipo multiplayer 3D de roleplay para navegador e dispositivos Android, com controles touch e layout paisagem.

## Requisitos
- Node.js 20+
- npm

## Executar localmente
```bash
npm install
npm start
```
Abra `http://localhost:3000` no navegador. Para jogar com outras pessoas, publique o projeto em um host que suporte Node.js e WebSockets/Socket.IO.

## O que mudou na V5
- Corrigido o cálculo do vetor de movimento e do ângulo do personagem, que podia fazê-lo andar de costas.
- Câmera em terceira pessoa reposicionada atrás da direção para a qual o personagem está virado.
- Movimento diagonal normalizado para evitar velocidade extra nas diagonais.
- Tela inicial de carregamento com progresso visual.
- Aviso para girar o celular para paisagem e ajustes para controles touch em celulares deitados.
- Atualização da versão e da identidade visual para URBAN Roleplay V5.

## Controles
- Teclado: WASD/setas para andar, Shift para correr, E para interagir, Enter para abrir o chat.
- Celular: analógico virtual para andar, botão Correr e botão Ação para interagir.
- GPS: botão no mapa ou comando `/gps` no chat.

## Observação
Esta é uma atualização do protótipo fornecido, não uma garantia de ausência absoluta de bugs. O jogo deve ser testado no aparelho e no servidor de destino; a tela de carregamento é visual e não substitui o carregamento real de assets. O APK Android precisa ser empacotado separadamente (por exemplo, com uma WebView/Cordova/Capacitor).
