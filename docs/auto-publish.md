# Auto Publisher — atualização contínua no GitHub

Mantém o PrintOS sempre sincronizado no GitHub sem você lembrar de `git push`.
A cada ciclo (padrão **5 min**) o `scripts/auto-publish.mjs`:

1. **commita** o que estiver pendente na árvore de trabalho (`git add -A` + commit);
2. **sincroniza** com o remoto — `git fetch` + `git rebase origin/<branch>` (nunca `merge`, nunca `--force`);
3. **checa o CI** — se o último run do workflow `CI` na branch estiver **vermelho**, o push é **PAUSADO** (o commit fica local, seguro, e o push volta sozinho quando o CI ficar verde);
4. **dá push** pro `origin/<branch>`.

Node puro, sem dependência nova. Um único ciclo nunca faz duas coisas ao mesmo tempo; um *lock* em `.git/printos-auto-publish.lock` impede duas instâncias.

> Substitui o "PrintOS Auto Publisher" externo (que só commitava local, sem push nem sync). A mensagem de commit agora é `chore(auto): publica alterações do PrintOS (N arquivos)`.

---

## Rodar na mão

```bash
npm run publish:once     # um ciclo e sai (bom pra testar)
npm run publish:dry      # mostra o que faria, sem commitar nem dar push
npm run publish:auto     # loop infinito em primeiro plano (Ctrl+C encerra limpo)
```

Flags equivalentes: `node scripts/auto-publish.mjs --once --dry-run --interval=120 --branch=main --no-ci-gate`.

## Rodar sozinho no Windows (Tarefa Agendada)

```powershell
pwsh scripts/auto-publish-service.ps1 -Install          # registra; inicia no logon
pwsh scripts/auto-publish-service.ps1 -Install -IntervalSec 180
pwsh scripts/auto-publish-service.ps1 -Start            # começa agora, sem reiniciar a máquina
pwsh scripts/auto-publish-service.ps1 -Status           # estado + últimas 20 linhas do log
pwsh scripts/auto-publish-service.ps1 -Stop
pwsh scripts/auto-publish-service.ps1 -Uninstall
```

A tarefa roda escondida, reinicia sozinha se cair e não para no fim da bateria.
Log em `scripts/.auto-publish.log` (ignorado pelo git).

## A trava de CI

A checagem tenta, em ordem:

1. **GitHub CLI** — `gh run list`. Cobre repo privado e respeita seu `gh auth login`.
   Instale com `winget install GitHub.cli` e rode `gh auth login`.
2. **API REST do GitHub** — `api.github.com/.../actions/runs`. Funciona sem `gh` porque
   o repo é público; pra repo privado ou pra subir o limite de requisições, defina
   `GITHUB_TOKEN` (ou `GH_TOKEN`) no ambiente.

Se **nenhuma** das duas responder, o push **não** é bloqueado (a trava só pausa em
falha *confirmada* do CI, nunca por dúvida) — aparece um `WARN` no log uma vez.

Estados que **pausam** o push: `failure`, `cancelled`, `timed_out`, `startup_failure`, `action_required`.
`in_progress` / `queued` **não** pausam.

Desligar a trava: `--no-ci-gate` ou `AUTOPUBLISH_CI_GATE=0`.

## Configuração

| Env | Flag | Padrão | O quê |
|---|---|---|---|
| `AUTOPUBLISH_INTERVAL_SEC` | `--interval=` | `300` | segundos entre ciclos (15–86400) |
| `AUTOPUBLISH_BRANCH` | `--branch=` | branch atual | branch alvo; o ciclo é pulado se você estiver em outra |
| `AUTOPUBLISH_REMOTE` | `--remote=` | `origin` | remote de destino |
| `AUTOPUBLISH_MESSAGE` | `--message=` | `chore(auto): publica alterações do PrintOS` | prefixo do commit |
| `AUTOPUBLISH_CI_GATE=0` | `--no-ci-gate` | ligado | desliga a trava de CI |
| `AUTOPUBLISH_CI_WORKFLOW` | `--ci-workflow=` | `CI` | nome do workflow a checar |
| `AUTOPUBLISH_LOG` | `--log=` | `scripts/.auto-publish.log` | arquivo de log |

## Comportamento em conflito

- **Rebase com conflito** → `git rebase --abort`, um `ERROR` no log, **nada é enviado**.
  Resolva à mão (`git status`) e o ciclo seguinte volta ao normal.
- **Push rejeitado** (o remoto andou entre o fetch e o push) → um `fetch` + `rebase` + 1 retry.
- **Você em branch diferente da alvo, ou `HEAD` destacado** → ciclo pulado com `WARN`.
- **CI vermelho** → push pausado; os commits ficam locais até o CI voltar ao verde.

## Cuidados

- Ele dá push **direto na branch alvo** (padrão `main`). É o comportamento desejado aqui
  (dev solo, atualização contínua) — não use numa branch compartilhada com review por PR.
- Cada push com novidade dispara o workflow `CI`. Só há push quando existe commit novo,
  então ciclos sem alteração não geram runs.
- Não rode duas instâncias na mesma cópia do repo (o lock barra, mas evite).
