# DELIVERY OS — HERCULANO GESTOR
**Controle Inteligente de Entregas**

Módulo SaaS de alta performance para controle operacional, despacho em tempo real, acompanhamento, fechamento de turnos e relatórios gerenciais de corridas realizadas por motoboys.

---

## 1. Visão Geral e Arquitetura

O **Delivery OS** foi arquitetado seguindo os padrões modernos de software como serviço (SaaS Multi-tenant):
- **Front-end:** React 19, TypeScript, Tailwind CSS, Lucide Icons.
- **Banco de Dados:** Cloud Firestore com isolamento estrito por `tenantId` e regras de segurança auditadas (`firestore.rules`).
- **Autenticação:** Firebase Authentication com suporte a e-mail/senha e Google OAuth.
- **Relatórios & Fechamentos:** Geração oficial de arquivos PDF com `jsPDF` e `jspdf-autotable`.
- **Trilha de Auditoria:** Registro cronológico e imutável para alteração manual de tarifas, cancelamentos, fechamento de turnos e cadastros.

---

## 2. Estrutura de Arquivos

```
/
├── firebase-applet-config.json    # Configurações do projeto Firebase provisionado
├── firebase-blueprint.json       # Esquema descritivo do modelo de dados
├── firestore.rules               # Regras de segurança granulares do Firestore (versão 2)
├── security_spec.md              # Especificação de segurança e casos negativos
├── index.html                    # Ponto de entrada com fontes e metadados
├── src/
│   ├── types/index.ts            # Tipos de domínio (Tenant, Motoboy, DeliveryOrder, etc.)
│   ├── lib/firebase.ts           # Inicialização do Firebase e tratador de erros padronizado
│   ├── utils/formatters.ts       # Validações de CPF/CNPJ, máscaras e moedas (R$ 0,00)
│   ├── services/
│   │   ├── db.ts                 # Camada de serviços Firestore multiempresa
│   │   └── pdfGenerator.ts       # Geração de PDFs para Fechamento de Turno e Relatórios
│   ├── context/
│   │   └── AuthContext.tsx       # Sessão, RBAC (Admin, Operador, Consulta) e isolamento
│   ├── components/
│   │   ├── layout/               # Navbar e Sidebar retrátil com tema Navy & Laranja
│   │   ├── auth/                 # Tela de Login, Cadastro de Empresa e Recuperação
│   │   ├── dashboard/            # 6 indicadores, gráficos e pódio dos motoboys
│   │   ├── dispatch/             # Quadro de despacho, tarifas automáticas e fechar turno
│   │   ├── registrations/        # Motoboys, Lojas (limite 10) e Tarifas por bairro
│   │   ├── reports/              # Central de relatórios, ranking e histórico de fechamentos
│   │   ├── company/              # Empresa administradora e upload de logomarca
│   │   ├── users/                # Gerenciamento de operadores e permissões
│   │   └── settings/             # Turnos, fuso horário e consulta à trilha de auditoria
│   ├── App.tsx                   # Roteamento e listeners em tempo real
│   ├── index.css                 # Estilização global
│   └── main.tsx                  # Bootstrap React
└── package.json
```

---

## 3. Critérios de Aceitação e Funcionalidades

1. **Autenticação e Multiempresa:**
   - Criação de nova conta empresarial com isolamento de dados.
   - Login por e-mail/senha ou Google.
   - Recuperação de senha por e-mail seguro.

2. **Despacho Operacional:**
   - Cadastro de corrida com preenchimento automático do valor ao selecionar a Loja e o Bairro.
   - Alerta e justificativa auditada para alterações manuais de valor.
   - Detecção de possível duplicidade com modal de confirmação formal.
   - Ações rápidas: Concluir entrega, Cancelar (motivo obrigatório), Cliente não encontrado.

3. **Fechamento de Turno:**
   - Prévia detalhada com contagem de entregas, financeiro e ranking de motoboys.
   - Trava inteligente contra fechamentos silenciosos com corridas pendentes.
   - Geração imediata de PDF oficial do fechamento.
   - Bloqueio de edição de corridas já fechadas.

4. **Cadastros:**
   - Motoboys com validação real de algoritmo de CPF e bloqueio de inativos em novos despachos.
   - Empresas parceiras de entrega com trava no servidor para o limite de 10 lojas do plano inicial.
   - Tabela individual de bairros e tarifas por loja.

5. **Relatórios Gerenciais:**
   - Relatório por Empresa de Entrega com subtotais.
   - Extrato individual por motoboy com CPF mascarado (`***.***.123-**`).
   - Relatório consolidado mensal.
   - Ranking por quantidade de entregas concluídas (desempate por última entrega).
   - Exportação em PDF e CSV.

6. **Empresa Administradora:**
   - Logomarca com upload e persistência integrada em todo o sistema e relatórios.

7. **Sistema de Notificações Push & Tempo Real:**
   - **Web Push Notifications:** Notificações nativas do sistema operacional e navegador para avisar o gestor e os motoboys mesmo com a aba em segundo plano.
   - **Sintetizador de Áudio (Web Audio API):** Sinal sonoro característico de entrega (chime de dois tons) ao despachar novas corridas, alerta de pendências demoradas e som de confirmação de conclusão sem depender de arquivos externos.
   - **Monitoramento de Pendências:** Detector automático em segundo plano que alerta quando uma corrida está pendente há mais de 20 minutos.
   - **Central de Notificações na Navbar:** Badge com contagem em tempo real, filtros por destinatário (Gestor / Motoboys / Pendências), botão de teste de notificação e alternador de áudio.

---

## 4. Instruções de Execução

```bash
# Instalação de dependências
npm install

# Execução em ambiente de desenvolvimento (Porta 3000)
npm run dev

# Compilação e checagem de tipos
npm run build
npm run lint
```
