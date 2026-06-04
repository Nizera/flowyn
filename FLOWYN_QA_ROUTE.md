# Flowyn - Rota Completa De Testes

Documento para executar uma validacao manual ponta a ponta da plataforma Flowyn usando duas contas.

Importante: nao salvar senhas em arquivos, prints ou relatorios publicos. Use as senhas fornecidas pelo solicitante apenas no momento do login.

## Contas De Teste

- Conta A - Produtor principal: `dnlmarianoneto@gmail.com`
- Conta B - Afiliado, aluno e produtor secundario: `dnlneto1@gmail.com`

## Objetivo

Validar tudo que hoje e possivel realizar na Flowyn:

- cadastro/login e protecao de sessoes;
- painel principal;
- assinatura Flowyn Pro e trial;
- conexao Asaas CPF/CNPJ;
- carteira/wallet;
- criacao de produtos;
- planos;
- conteudo de curso;
- experiencia de mentoria;
- editor de checkout;
- checkout transparente;
- order bump;
- afiliacao;
- pixels;
- webhooks;
- vendas;
- area do aluno;
- certificado;
- seguranca basica entre contas.

## Regras Do Teste

- Registrar print de cada tela relevante.
- Nao expor senha nos prints.
- Nao executar pagamento real sem confirmar que o ambiente e sandbox.
- Se algum fluxo estiver bloqueado por dados externos, registrar o bloqueio e continuar.
- Se encontrar erro visual, erro de console, loop, tela em branco ou permissao indevida, registrar como bug.
- Sempre indicar qual conta esta logada antes de cada etapa.
- Testar desktop primeiro e depois repetir os pontos visuais mais importantes em mobile.

## Evidencias Obrigatorias

Para cada etapa, coletar:

- URL acessada.
- Conta usada.
- Resultado esperado.
- Resultado obtido.
- Status: `PASS`, `FAIL`, `BLOCKED` ou `PARTIAL`.
- Print da tela.
- Console errors, se existirem.
- Observacoes.

## Rota 1 - Landing Page E Cadastro

1. Abrir a pagina inicial publica.
2. Validar proposta de valor: 7 dias gratis, R$ 49/mes, taxa Flowyn zero por venda.
3. Validar secoes de vantagens, comparativos e CTAs.
4. Clicar em CTA de cadastro.
5. Testar login com Conta A.
6. Fazer logout.
7. Testar login com Conta B.
8. Validar redirecionamento correto para dashboard.

Checks:

- layout sem texto cortado;
- mobile sem sobreposicao;
- CTA visivel;
- login sem erro;
- logout encerra sessao.

## Rota 2 - Assinatura Flowyn Pro

Usar Conta A.

1. Acessar `/dashboard/settings/subscription`.
2. Validar estado atual do trial/assinatura.
3. Confirmar texto de periodo gratis e valor mensal.
4. Verificar se o sistema bloqueia ou alerta quando a assinatura/trial nao permite vender.
5. Se houver botao de assinatura, clicar ate antes de confirmar pagamento.

Checks:

- trial exibido com data coerente;
- botao de assinatura claro;
- sem cobranca indevida;
- sem taxa por venda mencionada.

## Rota 3 - Conexao Asaas E Wallet

Usar Conta A.

1. Acessar `/dashboard/settings/payments`.
2. Validar escolha CPF/CNPJ.
3. Selecionar CPF.
4. Validar formulario de Pessoa Fisica.
5. Confirmar se existe opcao/link para criar conta CPF no painel Asaas quando a wallet nao existir.
6. Testar refresh/busca de wallet.
7. Confirmar estado conectado quando wallet existir.
8. Acessar `/dashboard/wallet`.
9. Validar saldo, wallet, avisos e instrucoes de saque.

Repetir principais checks com Conta B.

Checks:

- CPF nao deve ser bloqueado como se fosse apenas CNPJ;
- wallet existente deve ser reaproveitada;
- se nao houver subconta, mensagem deve orientar sem quebrar;
- Conta A nao deve ver wallet da Conta B.

## Rota 4 - Criacao De Produto Como Produtor

Usar Conta A.

Criar ou revisar tres tipos:

1. E-book/produto digital simples.
2. Curso online.
3. Mentoria/coaching.

Para cada produto:

1. Acessar `/dashboard/products/new`.
2. Preencher nome, descricao, categoria/tipo e imagens.
3. Salvar.
4. Abrir detalhes do produto.
5. Validar abas: Detalhes, Planos, Conteudo, Mentoria, Checkout.
6. Criar plano pago.
7. Verificar link de checkout.
8. Confirmar que URL do checkout usa dominio live, nao localhost.

Checks:

- produto aparece em `/dashboard/products`;
- nenhum produto fica com link localhost;
- Conta B nao consegue editar produto da Conta A;
- campos obrigatorios validam corretamente.

## Rota 5 - Curso Online

Usar Conta A.

1. Abrir produto do tipo curso.
2. Acessar aba Conteudo.
3. Criar modulo.
4. Criar aula.
5. Testar upload de video nativo, se disponivel.
6. Testar material/anexo, se disponivel.
7. Salvar conteudo.
8. Validar listagem das aulas.

Depois usar Conta B como aluno, apos compra/liberacao:

1. Acessar `/learn`.
2. Abrir curso.
3. Validar visual estilo Flowyn Play.
4. Abrir aula.
5. Marcar aula como concluida.
6. Adicionar comentario, se disponivel.
7. Concluir 100% do curso.
8. Abrir certificado.

Checks:

- video nao deve ficar publico sem controle;
- aluno sem compra nao deve acessar curso;
- progresso deve persistir;
- certificado deve abrir apenas para aluno autorizado.

## Rota 6 - Mentoria / Coaching

Usar Conta A como mentor.

1. Abrir produto do tipo mentoria.
2. Acessar aba Mentoria/Journey.
3. Criar ou revisar etapas da jornada.
4. Criar perguntas de diagnostico, se disponivel.
5. Criar horarios disponiveis, se disponivel.
6. Criar tarefa para aluno, se disponivel.

Usar Conta B como aluno, apos compra/liberacao:

1. Acessar `/learn`.
2. Abrir mentoria.
3. Responder diagnostico.
4. Agendar sessao, se disponivel.
5. Ver tarefas.
6. Marcar tarefa como concluida, se disponivel.

Checks:

- aluno so ve sua propria mentoria;
- mentor deve ver alunos vinculados, se a tela existir;
- horarios nao podem duplicar;
- diagnostico nao pode vazar para outro usuario.

## Rota 7 - Editor De Checkout

Usar Conta A.

1. Abrir produto com plano ativo.
2. Acessar aba Checkout.
3. Alterar banner.
4. Alterar mockup.
5. Alterar imagem do order bump, se existir.
6. Alterar headline, subheadline, texto do botao, selo de seguranca e garantia.
7. Alterar cor primaria e fundo.
8. Ativar/desativar blocos.
9. Clicar em Salvar rascunho.
10. Validar preview real em iframe.
11. Alternar desktop/mobile.
12. Confirmar que o preview tem as mesmas proporcoes do checkout real.
13. Confirmar que nao ha barra horizontal indevida.
14. Clicar em Publicar.
15. Abrir o checkout em nova aba e comparar com o preview.

Checks:

- preview deve usar o checkout real;
- rascunho deve aparecer apenas para owner;
- preview nao deve disparar pagamento;
- preview nao deve disparar pixels;
- checkout publicado deve continuar funcional.

## Rota 8 - Order Bump

Usar Conta A.

1. Abrir produto com order bump configurado.
2. Validar imagem e copy do order bump no editor.
3. Publicar checkout.
4. Abrir checkout real.
5. Selecionar order bump.
6. Confirmar que total muda.
7. Desmarcar order bump.
8. Confirmar que total volta ao valor original.

Checks:

- preco final correto;
- resumo lateral atualiza;
- order bump aparece tambem em checkout com afiliado.

## Rota 9 - Pixels

Usar Conta A.

1. Acessar `/dashboard/pixels`.
2. Criar pixel Meta fake/teste, Google fake/teste e TikTok fake/teste, se permitido.
3. Vincular pixel a produto/plano.
4. Abrir checkout publicado.
5. Confirmar scripts/eventos carregados apenas no checkout real.
6. Abrir preview do editor e confirmar que nao dispara pixels.

Usar Conta B como afiliado:

1. Acessar `/dashboard/affiliations`.
2. Configurar pixel de afiliado, se disponivel.
3. Abrir link de afiliado.
4. Confirmar deduplicacao e escopo.

Checks:

- preview sem pixels;
- checkout real com pixels ativos;
- afiliado nao consegue alterar pixel do produtor.

## Rota 10 - Afiliacao E Marketplace

Usar Conta A como produtor.

1. Confirmar produto publicado/vitrine.
2. Conferir comissao configurada.

Usar Conta B como afiliado.

1. Acessar `/market`.
2. Encontrar produto da Conta A.
3. Solicitar afiliacao ou copiar link, conforme fluxo existente.
4. Acessar `/dashboard/affiliations`.
5. Confirmar produto afiliado.
6. Abrir link de afiliado em aba anonima ou nova sessao.
7. Verificar parametro `ref`.
8. Realizar fluxo de checkout sandbox, se possivel.

Checks:

- produtor nao deve fazer split para si mesmo em venda propria afiliada;
- afiliado correto deve ser atribuido;
- comissao deve ser calculada;
- vendas aparecem para produtor e afiliado com visoes corretas.

## Rota 11 - Checkout E Pagamento Sandbox

Executar primeiro sem afiliado, depois com afiliado.

1. Abrir checkout publicado.
2. Validar layout branco transparente.
3. Preencher dados do comprador com dados sandbox.
4. Selecionar order bump.
5. Enviar pagamento sandbox.
6. Confirmar retorno para `/checkout/success`.
7. Confirmar criacao de pedido/venda.
8. Confirmar acesso do aluno.
9. Confirmar e-mail de definicao de senha, se aplicavel.

Checks:

- split Asaas aplicado corretamente;
- taxa Flowyn deve ser R$ 0,00;
- apenas taxa Asaas deve existir;
- order bump entra no total;
- aluno recebe acesso correto.

## Rota 12 - Vendas, Comissoes E Carteira

Usar Conta A.

1. Acessar `/dashboard/sales`.
2. Confirmar venda direta.
3. Confirmar venda com afiliado.
4. Ver detalhes/status.
5. Acessar `/dashboard/wallet`.
6. Conferir saldo/recebiveis.

Usar Conta B.

1. Acessar `/dashboard/sales`, se existir para afiliado.
2. Acessar `/dashboard/affiliations`.
3. Conferir comissao.
4. Acessar `/dashboard/wallet`.

Checks:

- produtor nao ve dados indevidos do comprador alem do necessario;
- afiliado nao ve dados sensiveis do produtor;
- valores batem com plano, order bump e comissao;
- status de pagamento coerente.

## Rota 13 - Area Do Aluno

Usar Conta B.

1. Acessar `/learn`.
2. Confirmar lista de acessos.
3. Abrir curso comprado.
4. Abrir mentoria comprada.
5. Testar progresso, comentario, materiais, certificado e diagnostico.

Testar negativo:

1. Tentar acessar URL de curso sem permissao.
2. Tentar acessar certificado de outro usuario.
3. Tentar abrir arquivo de storage diretamente, se URL estiver visivel.

Checks:

- RLS/permissao funcionando;
- URLs assinadas expiram ou nao ficam publicas;
- acesso indevido bloqueado.

## Rota 14 - Webhooks

Usar Conta A.

1. Acessar `/dashboard/webhooks`.
2. Criar endpoint de teste, se disponivel.
3. Acessar `/developers/webhooks`.
4. Validar documentacao.
5. Simular evento ou verificar eventos recentes.
6. Acessar `/api/webhooks/retry`, se houver interface indireta ou botao.

Checks:

- segredo/token nao aparece completo;
- retries nao duplicam venda;
- falhas sao registradas.

## Rota 15 - Perfil E Segurança Entre Contas

Conta A e Conta B.

1. Acessar `/dashboard/settings/profile`.
2. Alterar nome de perfil e salvar.
3. Confirmar persistencia.
4. Tentar acessar manualmente URLs de recursos da outra conta:
   - produto;
   - checkout editor;
   - conteudo;
   - vendas;
   - wallet;
   - certificado;
   - learn.

Checks:

- deve redirecionar, negar ou mostrar vazio;
- nunca deve exibir dados de outra conta;
- nenhum erro 500 por permissao negada.

## Rota 16 - Responsividade E Visual

Testar em:

- desktop 1440px;
- notebook 1280px;
- tablet;
- mobile 390px.

Telas obrigatorias:

- landing;
- dashboard;
- produtos;
- novo produto;
- produto detalhe;
- editor de checkout;
- checkout real;
- market;
- afiliacoes;
- vendas;
- pagamentos Asaas;
- wallet;
- area do aluno;
- curso;
- mentoria;
- certificado.

Checks:

- sem texto cortado;
- sem barra horizontal indevida;
- botoes clicaveis;
- cards nao sobrepostos;
- inputs visiveis;
- menu acessivel.

## Rota 17 - Relatorio Final

O relatorio final deve conter:

- resumo executivo;
- tabela de status por rota;
- bugs criticos;
- bugs medios;
- bugs visuais;
- bloqueios externos;
- prints organizados por rota;
- recomendacoes antes de colocar usuarios reais;
- lista de funcionalidades que parecem incompletas;
- lista de funcionalidades prontas para uso.

## Prompt Para Manus.ai

Copie e cole o prompt abaixo no Manus.ai.

```text
Voce e um agente de QA senior. Execute uma validacao manual ponta a ponta da plataforma Flowyn usando navegador real, screenshots e relatorio estruturado.

Use duas contas:
- Conta A, produtor principal: dnlmarianoneto@gmail.com
- Conta B, afiliado/aluno/produtor secundario: dnlneto1@gmail.com

As senhas serao fornecidas manualmente pelo usuario no momento do login. Nao salve, nao fotografe e nao repita as senhas no relatorio.

Objetivo:
Testar todas as funcionalidades disponiveis da Flowyn: landing, cadastro/login, dashboard, assinatura/trial, conexao Asaas CPF/CNPJ, wallet, produtos, planos, curso online, mentoria/coaching, editor de checkout, checkout transparente, order bump, pixels, afiliacao, marketplace, pagamento sandbox, vendas, comissoes, area do aluno, certificado, webhooks, perfil, seguranca entre contas e responsividade.

Regras:
1. Antes de cada etapa, informe qual conta esta logada.
2. Nao execute pagamento real sem confirmar que e sandbox.
3. Nao exponha senha em prints ou texto.
4. Registre URL, resultado esperado, resultado obtido, status PASS/FAIL/BLOCKED/PARTIAL, print e erros de console.
5. Se algo estiver bloqueado por configuracao externa, registre como BLOCKED e continue.
6. Teste tambem tentativas negativas: Conta B nao pode editar/ver dados privados da Conta A e Conta A nao pode ver dados privados da Conta B.
7. Verifique desktop e mobile.

Roteiro:
1. Landing page e login/logout com Conta A e Conta B.
2. Assinatura Flowyn Pro/trial em /dashboard/settings/subscription.
3. Conexao Asaas CPF/CNPJ em /dashboard/settings/payments e wallet em /dashboard/wallet.
4. Criacao/revisao de produtos: e-book, curso online e mentoria.
5. Planos, links de checkout e confirmacao de dominio live, nunca localhost.
6. Curso online: modulos, aulas, upload de video/material, area do aluno /learn, progresso, comentarios e certificado.
7. Mentoria/coaching: jornada, diagnostico, agenda, sessoes, tarefas e visao do aluno.
8. Editor de checkout: imagens, copy, cores, blocos, salvar rascunho, preview iframe, desktop/mobile e publicar.
9. Comparar preview do editor com checkout real aberto em outra aba; deve ter as mesmas proporcoes e nao ter barra horizontal indevida.
10. Order bump: selecionar/desmarcar e validar total.
11. Pixels: criar/configurar, validar que checkout real dispara e preview nao dispara.
12. Marketplace e afiliacao: Conta B pega link de afiliado do produto da Conta A.
13. Checkout com e sem afiliado usando sandbox, validando split, taxa Flowyn R$ 0,00 e acesso do aluno.
14. Vendas, comissoes e carteira para produtor e afiliado.
15. Webhooks e documentacao de desenvolvedor.
16. Perfil e seguranca entre contas.
17. Responsividade em desktop, tablet e mobile.

Entregavel final:
Crie um relatorio completo com:
- resumo executivo;
- tabela por rota com PASS/FAIL/BLOCKED/PARTIAL;
- bugs criticos, medios e visuais;
- prints;
- erros de console;
- riscos de seguranca;
- funcionalidades incompletas;
- recomendacoes antes de liberar para usuarios reais.
```
