# Randomizador de Salas — Documento de Design

**Data:** 2026-06-11
**Escola:** EEMTI Maria Luiza Saboia
**Status:** Aprovado para planejamento

## Objetivo

Webapp offline para redistribuir alunos de várias turmas em salas de avaliação,
embaralhando-os de modo que alunos da mesma turma fiquem o mais distante possível
entre si dentro de uma sala. Gera, para cada sala, um mapa ilustrado e uma lista
de frequência, ambos prontos para impressão em uma única folha cada.

## Restrições e princípios

- **100% offline.** Um único arquivo HTML autocontido (HTML + CSS + JS, sem
  dependências externas, sem CDN, sem servidor). Abre com duplo clique no navegador.
- **Sem build.** Nada de Node/bundler necessário para usar o app. (Ferramentas de
  teste podem rodar à parte, mas o artefato entregue é o `.html`.)
- **Persistência local.** Logotipo da escola e a última lista colada ficam salvos
  em `localStorage`, sobrevivendo ao fechar/reabrir o navegador.
- **Interface simples, clean e amigável.** Em português.
- **Cada documento impresso cabe em uma única folha (A4).**

## Fluxo de uso

1. **Configuração (persistente):**
   - Carregar o logotipo da escola (imagem PNG/JPG). Fica salvo localmente e aparece
     no topo de todos os documentos impressos.
   - Campo **Nome da avaliação** (texto livre).
   - **Data:** preenchida automaticamente com a data do dia, editável.

2. **Colar listas de alunos:**
   - Um único campo de texto onde se cola uma ou mais turmas participantes.
   - Formato esperado (repetível para várias turmas):
     ```
     1º A
     1 - Maria Silva
     2 - João Souza
     3 - Ana Pereira

     1º B
     1 - Pedro Lima
     ...
     ```
   - **Regra de parsing:** uma linha que **não** casa com o padrão de aluno numerado
     é tratada como **cabeçalho de turma** (nome da turma). Linhas seguintes que casam
     com o padrão numerado (`N - Nome`, `N. Nome`, `N) Nome`, `N Nome`) são alunos da
     turma corrente. O número original é descartado (o app renumera dentro de cada sala).
     Linhas em branco são ignoradas.
   - **Prévia ao vivo:** lista as turmas detectadas com a contagem de alunos de cada
     uma e o total (nº de turmas · nº de alunos), para conferência antes de gerar.

3. **Escolher número de salas:** campo numérico de 1 a 8. O app **sugere** um valor
   padrão com base no total de alunos (ver abaixo); o usuário pode ajustar.

4. **Gerar:** o app distribui os alunos e monta os documentos de todas as salas.
   - Botão **"Gerar novamente"** produz um novo sorteio (arranjo diferente) com os
     mesmos dados.

## Distribuição e disposição ("anti-cola")

### Sugestão de número de salas
Padrão sugerido = `arredonda_para_cima(total_de_alunos / 45)`, limitado a 1–8.
(Mantém cada sala dentro da capacidade de 45 lugares.) O usuário pode sobrescrever.

### Distribuição entre salas
- Objetivo: salas equilibradas em tamanho **e** alunos de cada turma espalhados o
  mais uniformemente possível entre as salas.
- Método: para cada turma, distribuir seus alunos (em ordem aleatória) de forma
  rodízio entre as salas. Assim cada sala recebe aproximadamente a mesma quantidade
  de cada turma, e o total por sala fica balanceado.
- A turma de origem de cada aluno é sempre preservada e exibida.

### Disposição dentro da sala (assentos)
- A sala tem 45 lugares: **5 fileiras (colunas, lado a lado) × 9 cadeiras (em
  profundidade, da frente ao fundo)**.
- Objetivo: dois alunos da mesma turma ficam o mais distante possível entre si;
  nunca em cadeiras adjacentes quando houver alternativa.
- Método (heurístico): ordenar os lugares numa sequência serpenteante e preencher
  alternando as turmas em rodízio (sempre puxando da turma com mais alunos restantes,
  evitando repetir a turma do lugar vizinho). Lugares sem aluno ficam vazios e são
  marcados como "vazio".
- É um heurístico de melhor esforço; não há garantia de distância mínima exata, mas
  o resultado mantém as mesmas turmas visivelmente separadas.

## Saídas (por sala)

Cada sala tem dois documentos imprimíveis. A impressão é feita pelo próprio
navegador (Ctrl+P → impressora física ou "Salvar como PDF"). CSS de impressão
garante que cada documento ocupe **uma única folha** e inclua o **logotipo** no topo.

### Mapa de sala ilustrado
- Cabeçalho: logotipo, nome da escola, nome da avaliação, data, identificação da sala.
- **Quadro ao fundo (topo)**, **mesa do professor à frente dele**, todas as cadeiras
  voltadas para a frente.
- Grade 5×9 com nome do aluno + turma de origem em cada cadeira.
- **Cores por turma** (uma cor por turma) para evidenciar o espalhamento; legenda das
  cores. Lugares vazios marcados.

### Lista de frequência
- Cabeçalho: logotipo, nome da escola, nome da avaliação, data, identificação da sala.
- Tabela com colunas: **Nº · Nome do aluno · Turma · Presença · Assinatura**.
- Ordenada de forma legível (ex.: por nome) — cabe em uma folha (até 45 linhas).

## Arquitetura (visão geral)

Arquivo único `index.html` organizado em módulos lógicos (no mesmo arquivo ou em
`<script>`s separados durante o desenvolvimento, concatenados na entrega):

- **parser** — converte o texto colado em estrutura `{ turma, alunos[] }`.
  Entrada: string. Saída: lista de turmas com alunos. Sem efeitos colaterais.
- **distribuidor** — recebe turmas + nº de salas; devolve as salas com seus alunos
  (preservando turma), equilibradas e com turmas espalhadas. Função pura + semente
  aleatória para permitir "gerar novamente".
- **assentos** — recebe os alunos de uma sala; devolve o arranjo 5×9 com mesmas
  turmas o mais distante possível. Função pura.
- **persistencia** — leitura/gravação de logotipo e última lista em `localStorage`.
- **ui** — telas (configuração, colar/prévia, resultados) e ações.
- **impressao** — CSS `@media print` e marcação dos documentos por sala.

Cada módulo tem propósito único e interface clara, podendo ser testado isoladamente
(o parser, o distribuidor e os assentos são funções puras, fáceis de cobrir com testes).

## Fora de escopo (YAGNI)

- Contas de usuário, nuvem, sincronização.
- Edição manual de assentos arrastando alunos.
- Exportação para Excel/CSV.
- Mais de 8 salas ou salas com geometria diferente de 5×9.
