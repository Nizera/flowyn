# Flowyn Tasks

Documento vivo para acompanhar o que falta construir, testar e validar na Flowyn.

Status:
- [ ] Pendente
- [~] Em andamento
- [x] Concluído

## 1. Validação Ponta A Ponta Em Produção

- [ ] Testar compra real/sandbox de curso online em produção.
- [ ] Confirmar criação automática de acesso do aluno após pagamento aprovado.
- [ ] Confirmar e-mail da Flowyn para definição de senha.
- [ ] Confirmar redirecionamento do aluno para `/learn` após definir senha.
- [ ] Confirmar acesso ao curso em `/learn/[id]`.
- [ ] Confirmar reprodução de vídeo nativo com URL assinada.
- [ ] Confirmar download/acesso a materiais nativos da aula.
- [ ] Confirmar comentários por aula.
- [ ] Confirmar progresso de aula concluída.
- [ ] Confirmar emissão automática de certificado ao concluir 100% das aulas.
- [ ] Testar compra real/sandbox de mentoria em produção.
- [ ] Confirmar diagnóstico da mentoria pelo aluno.
- [ ] Confirmar agendamento de sessão pelo aluno.
- [ ] Confirmar tarefa atribuída pelo mentor.
- [ ] Confirmar e-mails de aula, tarefa e sessão.
- [ ] Corrigir bugs encontrados nos fluxos reais.

## 2. Infraestrutura De Storage E E-mail

- [ ] Validar bucket `product-files` para vídeos nativos.
- [ ] Validar limite de upload desejado para vídeo.
- [ ] Revisar políticas de Storage privado.
- [ ] Garantir que aluno só acessa arquivo por URL assinada.
- [ ] Validar `RESEND_API_KEY` em produção.
- [ ] Validar domínio remetente da Flowyn.
- [ ] Validar `NEXT_PUBLIC_APP_URL` em produção.
- [ ] Registrar falhas de envio em `notification_events`.
- [ ] Criar rotina para reprocessar notificações com status `failed`.

## 3. Certificados

- [ ] Melhorar página visual do certificado.
- [ ] Adicionar botão real de imprimir.
- [ ] Adicionar geração/download em PDF.
- [ ] Criar página pública de validação por código.
- [ ] Adicionar QR Code no certificado.
- [ ] Adicionar e-mail de certificado emitido.

## 4. Painel Do Mentor Por Aluno

- [ ] Criar tela de alunos da mentoria.
- [ ] Listar alunos por produto de mentoria.
- [ ] Abrir perfil individual do mentorado.
- [ ] Exibir diagnóstico completo do aluno.
- [ ] Exibir sessões do aluno.
- [ ] Exibir tarefas do aluno.
- [ ] Permitir criar tarefa direto no perfil do aluno.
- [ ] Permitir remarcar/cancelar sessão.
- [ ] Exibir progresso da jornada.
- [ ] Adicionar anotações privadas do mentor.

## 5. Upload De Vídeo Profissional

- [ ] Melhorar barra de progresso de upload.
- [ ] Validar formato antes do envio.
- [ ] Exibir tamanho do arquivo.
- [ ] Capturar thumbnail do vídeo.
- [ ] Capturar duração automaticamente.
- [ ] Permitir trocar vídeo da aula.
- [ ] Permitir remover vídeo antigo com segurança.
- [ ] Planejar processamento/transcoding futuro.

## 6. Comentários E Dúvidas Por Aula

- [ ] Permitir resposta do produtor.
- [ ] Permitir respostas encadeadas.
- [ ] Marcar dúvida como respondida.
- [ ] Fixar comentário importante.
- [ ] Notificar produtor sobre novo comentário.
- [ ] Notificar aluno quando produtor responder.
- [ ] Adicionar rate limit para comentários.
- [ ] Adicionar moderação/exclusão segura.

## 7. Agenda De Mentoria

- [ ] Permitir cancelar sessão.
- [ ] Permitir remarcar sessão.
- [ ] Tratar fuso horário.
- [ ] Criar lembrete 24h antes da sessão.
- [ ] Criar lembrete 1h antes da sessão.
- [ ] Enviar confirmação ao mentor quando aluno agenda.
- [ ] Bloquear reserva duplicada no mesmo horário.
- [ ] Exibir calendário mensal/semanal.
- [ ] Integrar Google Calendar futuramente.

## 8. Área De Membros Flowyn Play

- [ ] Melhorar seção "Continuar assistindo".
- [ ] Tornar aula atual selecionável na interface.
- [ ] Criar busca dentro do curso.
- [ ] Permitir módulos colapsáveis.
- [ ] Exibir progresso por módulo.
- [ ] Adicionar estado "próxima aula".
- [ ] Melhorar visual mobile.
- [ ] Adicionar tela de boas-vindas do curso.

## 9. Relatórios

- [ ] Relatório de alunos por curso.
- [ ] Relatório de taxa de conclusão.
- [ ] Relatório de aulas mais abandonadas.
- [ ] Relatório de comentários/dúvidas por aula.
- [ ] Relatório de mentorias ativas.
- [ ] Relatório de tarefas atrasadas.
- [ ] Relatório de sessões realizadas.
- [ ] Exportação financeira.
- [ ] Relatórios por produto.
- [ ] Relatórios por afiliado.

## 10. Página Pública De Venda Por Tipo

- [ ] Criar layout público específico para curso online.
- [ ] Criar layout público específico para mentoria.
- [ ] Criar layout público específico para e-book.
- [ ] Exibir módulos/aulas preview em curso.
- [ ] Exibir mapa da jornada em mentoria.
- [ ] Exibir bônus/order bump quando aplicável.
- [ ] Melhorar CTA para checkout.
- [ ] Permitir personalização visual pelo produtor.

## 11. Editor De Checkout [~]

Objetivo: permitir que o produtor edite e visualize o checkout antes de publicar, com experiência parecida com um editor visual.

### 11.1 Estrutura [x]

- [x] Criar rota `/dashboard/products/[id]/checkout-editor`.
- [x] Adicionar botão "Editar Checkout" no painel do produto.
- [x] Criar tabela/configuração de customização do checkout.
- [x] Salvar configurações por produto.
- [x] Definir preview do checkout sem afetar checkout publicado.
- [x] Criar ação para publicar alterações do checkout.
- [x] Criar status `draft` e `published` para configuração visual.

### 11.2 Preview Visual [~]

- [x] Renderizar preview fiel do checkout atual.
- [x] Exibir produto, plano, preço e produtor.
- [x] Exibir order bump no preview quando existir.
- [ ] Exibir estado com afiliado simulado.
- [x] Exibir layout desktop.
- [x] Exibir layout mobile.
- [x] Criar alternância desktop/mobile no editor.
- [x] Criar modo claro como padrão.

### 11.3 Blocos Editáveis [~]

- [x] Bloco de banner principal.
- [x] Bloco de imagem/mockup do produto.
- [ ] Bloco de vídeo de vendas.
- [x] Bloco de garantia.
- [x] Bloco de benefícios.
- [ ] Bloco de depoimentos.
- [ ] Bloco de FAQ.
- [x] Bloco de order bump.
- [x] Bloco de resumo do pedido.
- [x] Bloco de identidade visual.

### 11.4 Upload E Drag And Drop [~]

- [x] Permitir clicar para anexar imagem no mockup.
- [x] Permitir arrastar imagem até o campo mockup.
- [x] Permitir trocar imagem do banner.
- [x] Permitir trocar imagem do order bump.
- [x] Validar tamanho/formato das imagens.
- [x] Usar bucket seguro para assets do checkout.
- [x] Mostrar preview instantâneo após upload.
- [x] Permitir remover imagem.

### 11.5 Personalização [~]

- [x] Cor primária do checkout.
- [x] Cor de fundo.
- [x] Cor dos botões.
- [x] Texto do botão principal.
- [x] Selo de segurança.
- [x] Texto de garantia.
- [x] Headline curta do checkout.
- [x] Subheadline.
- [ ] Ordem dos blocos.
- [x] Ativar/desativar blocos.

### 11.6 Segurança E Publicação [~]

- [x] Sanitizar textos editáveis.
- [x] Impedir scripts/HTML arbitrário.
- [x] Validar URLs externas.
- [x] Garantir que preview não exponha dados reais de comprador.
- [x] Garantir que somente owner edita o checkout.
- [ ] Criar auditoria de publicação.
- [ ] Testar checkout publicado após edição.
- [ ] Testar rollback para versão anterior.

### 11.7 Futuro

- [ ] Templates prontos de checkout.
- [ ] Duplicar checkout de outro produto.
- [ ] Histórico de versões.
- [ ] A/B test de checkout.
- [ ] Métricas de conversão por versão.

## 12. Automação E IA

- [ ] Gerar estrutura de curso com IA.
- [ ] Gerar perguntas de diagnóstico de mentoria com IA.
- [ ] Resumir progresso do aluno.
- [ ] Sugerir próxima tarefa de mentoria.
- [ ] Gerar copy de checkout.
- [ ] Gerar FAQ do produto.
- [ ] Gerar e-mail de boas-vindas.

## 13. Segurança E Operação

- [ ] Auditar RLS das tabelas novas.
- [ ] Auditar Storage privado.
- [ ] Adicionar rate limit em comentários.
- [ ] Adicionar rate limit em agendamentos.
- [ ] Adicionar logs de erro para e-mails.
- [ ] Criar rotina de limpeza de arquivos órfãos.
- [ ] Criar rotina de limpeza de links expirados.
- [ ] Resolver lint antigo do projeto.
- [ ] Rodar advisors do Supabase após novas migrations.
- [ ] Testar backup/restore das tabelas críticas.

## 14. Validação Visual

- [ ] Corrigir acesso ao Browser plugin no ambiente local.
- [ ] Capturar screenshots da landing.
- [ ] Capturar screenshots do painel do produtor.
- [ ] Capturar screenshots do builder de curso.
- [ ] Capturar screenshots do Flowyn Play.
- [ ] Capturar screenshots do Flowyn Journey.
- [ ] Capturar screenshots do certificado.
- [ ] Capturar screenshots do editor de checkout.
- [ ] Validar mobile.
- [ ] Validar desktop.
