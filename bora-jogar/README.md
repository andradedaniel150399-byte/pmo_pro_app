# Bora Jogar

Um "iFood dos esportes": tu escolhe o esporte e a cidade, e o app mostra onde jogar, os horários livres e quanto custa.

Este é o **protótipo navegável** (mobile-first), em um único arquivo `index.html`, sem build. Os locais e horários são **dados de exemplo**.

## Como abrir

- Abra `bora-jogar/index.html` direto no navegador do celular ou do computador, ou
- sirva a pasta: `npx serve bora-jogar` e acesse pelo celular na mesma rede.

## O que já funciona

- Escolha de esporte (12 modalidades) e cidade (POA, SP, RJ, Floripa, BH, Curitiba)
- Grade dos próximos 7 dias + filtros de preço (grátis/pago) e período (manhã/tarde/noite)
- Lista de locais com tipo (quadra para alugar, grupo aberto, aula, espaço público), custo e horários livres
- Detalhe do local: horários por dia, explicação do custo, o que levar
- Reserva / confirmação de presença, lista de reservas com cancelamento
- Favoritos
- Reservas, favoritos, cidade e esporte ficam salvos no aparelho (localStorage)

## Próximos passos sugeridos

1. **Backend e dados reais** – tabelas `venues`, `schedules`, `bookings`, `users` (o repositório já usa Supabase).
2. **Cadastro de locais** – painel para donos de quadra, professores e organizadores de grupos publicarem horários e preços.
3. **Localização** – ordenar por distância usando o GPS do celular.
4. **Pagamento** – Pix na reserva (ex.: Mercado Pago ou Stripe), com divisão entre os jogadores.
5. **App nativo** – empacotar como PWA instalável ou migrar para React Native/Expo.
