# Battle Royale 1.0 — protótipo online

Primeira base jogável para navegador Android em paisagem, usando Three.js, JavaScript, Node.js e Socket.IO. Não gera APK.

## O que já existe
- Lobby com nick e botão para entrar na partida.
- Arena 3D leve, jogadores online sincronizados e HUD.
- Controles touch: joystick, arrastar no lado direito para câmera, pular, correr, agachar e atirar.
- Vida, dano, eliminações/kill feed e retorno ao lobby ao ser eliminado.
- Rodadas temporizadas e estado inicial de ranqueada demonstrativo.

## Requisitos
Node.js 18 ou superior e npm.

## Rodar localmente
```bash
npm install
npm start
```
Abra `http://localhost:3000` no navegador. Para testar multiplayer, abra em dois dispositivos/navegadores conectados ao mesmo servidor.

## Publicar no GitHub e Render
1. Crie um repositório GitHub e envie todos os arquivos desta pasta.
2. No Render, escolha **New + → Web Service** e conecte o repositório.
3. Build Command: `npm install`
4. Start Command: `npm start`
5. O Render define `PORT` automaticamente. Após deploy, abra a URL HTTPS fornecida.

## Controles mobile
- Joystick à esquerda: mover.
- Arraste no lado direito da tela: girar a câmera.
- PULAR, CORRER, AGACHAR e ATIRAR: botões do lado direito.

## Importante: estado do protótipo
Esta é uma **primeira versão jogável**, não uma versão competitiva sem bugs. A movimentação ainda é validada parcialmente pelo cliente, a mira/tiro usa uma checagem simples de ângulo e distância, e o botão de ranqueada inicia uma rodada de teste (não há matchmaking real de 20 jogadores, persistência de MMR, zona segura, inventário ou anti-cheat robusto). Não exponha como jogo competitivo final sem reforçar a simulação autoritativa do servidor, testes e limites de conexão.

## Próximas etapas recomendadas
1. Tornar o servidor autoritativo para movimento, colisões e validação de disparos.
2. Implementar fila/matchmaking de até 20 jogadores e início automático com contagem regressiva.
3. Adicionar zona segura, loot, armas e recarga.
4. Implementar MMR ranqueado persistente (SQLite/PostgreSQL), temporadas e reconexão.
5. Fazer testes mobile em diferentes proporções e redes.
