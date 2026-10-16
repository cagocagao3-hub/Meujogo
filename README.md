# URBAN Roleplay V3 — protótipo multiplayer 3D

Protótipo inicial para navegador/Android com Three.js, Node.js, Socket.IO e SQLite.

## Recursos desta build
- Registro/login com hash de senha bcrypt.
- Personagem 3D básico e cidade procedural de teste.
- Controles WASD e joystick no celular.
- Multiplayer básico: jogadores, movimento e contador online.
- Chat global.
- Seleção de emprego e pagamento de $50 a cada 30 segundos.
- Veículos 3D de demonstração e ação para tentar entrar.
- Persistência SQLite para conta, dinheiro, emprego e posição.
- Interface adaptada a telas pequenas.

## Requisitos
Node.js 18 ou superior. Para desenvolver no Android, use Termux com Node.js, ou edite o projeto no GitHub e publique no Render.

## Executar no computador/Termux
```bash
npm install
npm start
```
Abra `http://localhost:3000`.

No Termux, se o pacote `better-sqlite3` não conseguir compilar, a alternativa mais simples é executar a build no Render ou trocar o driver SQLite por um compatível com o ambiente. O Android não é um ambiente de hospedagem estável para deixar o servidor 24h online.

## Publicar no Render pelo celular
1. Crie um repositório no GitHub e envie todos os arquivos desta pasta.
2. No Render, escolha **New + → Blueprint** e conecte o repositório com `render.yaml`, ou crie um Web Service Node.
3. Build command: `npm install`; Start command: `npm start`.
4. Configure um disco persistente em `/var/data` e `DATABASE_PATH=/var/data/urban.sqlite`.
5. Abra a URL fornecida pelo Render no navegador do Android.

O plano grátis e as condições de hospedagem podem mudar. Confirme limites e disponibilidade no painel do provedor.

## Limitações importantes
Esta é uma **build de protótipo**, não um jogo pronto para lançamento comercial. Os modelos de personagens, carros e edifícios são formas 3D simples. O sistema de dirigir é apenas demonstrativo; não há física veicular completa, animações profissionais, interior de casas, polícia, facções ou inventário avançado ainda.

O token de login desta primeira build fica em memória no servidor; após reiniciar o servidor, pode ser necessário entrar novamente. Antes de abrir ao público, implemente sessão persistente/expiração, rate limiting, validação autoritativa de movimento, proteção contra spam no chat, moderação, backups e testes de carga. A persistência do SQLite depende de configurar corretamente um disco persistente na hospedagem.

## Próximos passos sugeridos
1. Testar registro/login em duas janelas ou dispositivos.
2. Corrigir bugs encontrados no Android.
3. Implementar condução real com sincronização do veículo.
4. Adicionar criação/customização de personagem e inventário.
5. Migrar para um banco gerenciado se o projeto crescer.
