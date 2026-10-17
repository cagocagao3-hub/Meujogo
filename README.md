# URBAN Roleplay V6.0

Protótipo multiplayer 3D para navegador, com layout adaptável a celular em orientação horizontal.

## Executar

1. Instale Node.js 20 ou superior.
2. Na pasta do projeto, execute `npm install`.
3. Execute `npm start`.
4. Abra `http://localhost:3000` (ou a URL/porta informada pelo host).

## Mudanças V6.0

- Refeito o controle virtual com Pointer Events e captura do ponteiro para evitar saltos quando há mais de um toque na tela.
- Unificada a convenção de direção/rotação do personagem e corrigida a posição da câmera de acompanhamento.
- Renderização mais leve para dispositivos móveis: pixel ratio limitado a 0,85 e sombras em tempo real desligadas.
- Mantido salvamento automático no servidor a cada 30 segundos e ao desconectar; não é necessário botão de salvar.
- Versão do pacote atualizada para 6.0.0.

## Importante

Este pacote foi verificado com `node --check` nos arquivos JavaScript do projeto. Isso não substitui testes reais no Android nem comprova ausência total de bugs. O jogo ainda é um protótipo: recursos como veículos de passeio completos, colisões físicas e persistência de novos sistemas precisam de implementação/testes adicionais. Faça backup do banco de dados antes de atualizar uma instalação existente.
