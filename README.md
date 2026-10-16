# URBAN Roleplay V4.1 — atualização multiplayer 3D

Build de evolução para navegador e Android, usando Three.js, Node.js, Socket.IO e SQLite.

## Novidades da V4.1
- Interface do jogo refeita, com HUD menor, chat compacto no canto superior esquerdo e GPS/minimapa.
- Cidade procedural ampliada visualmente com avenidas, calçadas, prédios, janelas, árvores, postes, praça e placas.
- Personagem reconstruído com volumes arredondados, proporções mais naturais e animação básica de caminhada/corrida. Continua sendo um modelo original simplificado, não um modelo oficial de GTA V.
- Correção da orientação do personagem, câmera de terceira pessoa mais suave e distante, joystick de toque, WASD/setas e corrida.
- Centro de Empregos no checkpoint amarelo e bases separadas no mapa: Garagem de Entregas, Ponto de Táxi e Oficina Mecânica. Ao ser contratado, o personagem é levado à base correspondente.
- Turnos iniciados na base específica da profissão, com placas e checkpoints próprios. Entregador recebe uma moto; Taxista e Mecânico recebem veículos de serviço de demonstração.
- Cada serviço marca um destino no mundo e no minimapa. Ao chegar e interagir, o servidor valida a distância, paga $50 e encerra o turno.
- Chat global compacto, contador de jogadores, dinheiro e emprego atualizados.
- Login/cadastro com hash de senha, SQLite e endpoint de restauração de sessão enquanto a sessão existir em memória.

## Executar
```bash
npm install
npm start
```
Abra `http://localhost:3000`.

## Publicar no Render pelo celular
1. Envie todos os arquivos desta pasta para a raiz do repositório GitHub.
2. No Render, crie um **Web Service** conectado ao repositório.
3. Build Command: `npm install`.
4. Start Command: `npm start`.
5. Use Node.js 20.x. O arquivo `package.json` já fixa `engines.node` em `20.x`.

## Importante — protótipo, não versão final comercial
O visual é feito de modelos low-poly gerados por código; não são modelos de personagem de GTA/SAMP nem animações profissionais. O controle de moto/carro é uma representação inicial de serviço e não possui física veicular completa, colisões complexas ou sincronização de veículo entre jogadores. Taxista e Mecânico usam a mesma estrutura de missão de rota com veículos visuais diferentes. Polícia, facções, inventário avançado, interiores, economia completa e ferramentas administrativas ainda não foram implementados.

No Render grátis, o sistema de arquivos é temporário e o SQLite local pode perder dados após reinício/suspensão/deploy. Para preservar contas e dinheiro em produção, migre para um banco gerenciado como PostgreSQL. Os tokens ficam em memória no servidor, então após reiniciar pode ser necessário entrar novamente. Antes de abrir ao público, implemente rate limiting, sessões persistentes/expiração, validação autoritativa de movimento, proteção contra spam no chat, moderação, backups e testes de carga.


## V4.1 — atualização
- Corrigido o sentido do joystick e a orientação do personagem/câmera em terceira pessoa.
- Mapa reorganizado em distritos com prefeitura, garagem de entregas, ponto de táxi, oficina, hospital, delegacia, praça, mercado e marina.
- Comando `/GPS` no chat abre a lista de destinos e marca a rota no mapa.
- O botão ABRIR GPS também abre o navegador de destinos.
