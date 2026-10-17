# BR Elite 1.1 — protótipo de Battle Royale para navegador

Base web para Android em paisagem, com Node.js, Express, Socket.IO e Three.js. Sem APK.

## Executar
Requer Node.js 18+.
```bash
npm install
npm start
```
Abra http://localhost:3000. Para testar online, publique no GitHub e conecte o repositório a um Web Service no Render. Build: `npm install`; Start: `npm start`.

## O que foi redesenhado
- Lobby escuro moderno, painel de temporada, botão começar e navegação por páginas.
- Páginas de personagem, skins demonstrativas, arsenal, amigos, ranqueada e perfil.
- Mapa procedural maior, com vegetação, construções, rochas, estradas e hub.
- Personagem 3D procedural com roupa tática estilizada (não é uma cópia de assets do Free Fire).
- Controles touch e correção da câmera: arrastar para cima olha para cima; arrastar para baixo olha para baixo.
- Socket.IO para estado de jogadores, dano, eliminações e retorno ao lobby.
- Endpoint `/health` para verificação de saúde no Render.

## Login Google
O botão mostra instruções, mas OAuth real exige seu próprio projeto Firebase:
1. Crie um projeto no Firebase Console.
2. Ative Authentication → Sign-in method → Google.
3. Adicione o domínio `seu-servico.onrender.com` aos domínios autorizados.
4. Copie `public/firebase-config.js.example` para `public/firebase-config.js` e preencha os dados públicos do Firebase.
5. Implemente e teste o fluxo `signInWithPopup` ou `signInWithRedirect` com Firebase Auth. Em mobile, redirect costuma ser mais robusto. O arquivo de exemplo não contém segredos.

## Limitações honestas desta versão
Esta é uma UI/protótipo funcional, não um clone completo de Free Fire nem uma versão competitiva pronta. Amigos, convites, login Google, inventário persistente, ranking/MMR, matchmaking real e squads ainda precisam de backend/credenciais e implementação. A capacidade de 20 jogadores é um objetivo de arquitetura, não algo validado por teste de carga aqui. O servidor atual ainda aceita posição reportada pelo cliente; antes de ranked pública, faça simulação autoritativa no servidor, anti-cheat, rate limits, persistência e testes de carga.
