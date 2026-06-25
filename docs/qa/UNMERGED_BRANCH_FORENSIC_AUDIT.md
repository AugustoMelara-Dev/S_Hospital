# Unmerged Branch Forensic Audit

## Resumen

- Fecha de auditoria: 2026-06-22.
- Main auditado: 555a14f7529a566dc4e050e41451e76810eda301.
- Origin/main observado: 555a14f7529a566dc4e050e41451e76810eda301.
- Carpeta forense local: C:\Projects\S_Hospital-branch-forensics-20260622-0845.
- Bundle verificable: C:\Projects\S_Hospital-branch-forensics-20260622-0845\S_Hospital-all-refs.bundle.
- SHA256 del bundle: 2162C12CB7047CFC528394C159AB571B6F05E4C6592FED7BF3F9BB80DCAC51A3.
- Total de ramas locales: 251.
- Total de ramas remotas: 269.
- Total no integradas locales: 88.
- Total de grupos duplicados: 114 (same_sha=38, same_tree=39, same_file_set=37).
- Worktrees sucios: 3.
- Worktrees preservados: 3 preservados fisicamente; 0 publicados en archive por patrones sensibles/artefactos.
- Candidatos utiles comprobados y validados: 0.
- Candidatos obsoletos o superados: 1.
- Ramas peligrosas: 0 clasificadas como UNICA_Y_PELIGROSA.
- Ramas pendientes de decision: 7.

CSV incluidos:

- qa/branch-forensics/branch-inventory.csv
- qa/branch-forensics/local-unmerged-branch-analysis.csv
- qa/branch-forensics/unique-work-candidates.csv
- qa/branch-forensics/duplicate-groups.csv

## Metodo

Se verifico main, origin/main, el estado limpio del worktree principal y la lista de worktrees. Antes de analizar se creo un bundle con --all, se verifico y se registro SHA256. Para cada worktree sucio se guardaron estado, logs, diffs binarios rastreados, clasificacion de archivos y conteos de patrones sensibles sin exponer valores. Para cada rama local no integrada se calcularon SHA, tree hash, merge-base, ahead/behind, equivalencia aproximada de parches con git cherry -v, conteos de archivos por main...rama y main..rama, prioridad por rutas P0/P1/P2, y grupos por SHA/tree/file-set.

## Tabla por rama

| Rama | SHA | Fecha | Merge base | Ahead/behind | Tree igual | Cherry +/- | Archivos | Clasificacion | Evidencia | Accion recomendada |
|---|---|---|---|---:|---|---:|---:|---|---|---|
| audit/f6-post-approval-sensitive-a979d5b7 | a979d5b7 | 2026-06-14 | a9377e9f | 203/1 | False | +1/-0 | 17 | REQUIERE_DECISION_USUARIO | aheadBehind=203/1; cherryPlus=1; cherryMinus=0; files3=17; files2=894; priority=P0 | decisi?n humana/revisi?n focal antes de recuperaci?n |
| audit/f6-post-approval-sensitive-c851057f | c851057f | 2026-06-14 | a9377e9f | 203/1 | False | +1/-0 | 3 | REQUIERE_DECISION_USUARIO | aheadBehind=203/1; cherryPlus=1; cherryMinus=0; files3=3; files2=890; priority=P0 | decisi?n humana/revisi?n focal antes de recuperaci?n |
| codex/f6-operational-polish | a979d5b7 | 2026-06-14 | a9377e9f | 203/1 | False | +1/-0 | 17 | DUPLICADO_DE_OTRA_RAMA | aheadBehind=203/1; cherryPlus=1; cherryMinus=0; files3=17; files2=894; priority=P0; duplicateShaOf=audit/f6-post-approval-sensitive-a979d5b7 | no recuperar como unidad; duplicado de referencia preservada |
| codex/final-rc-scope-cutover | 70df4b7e | 2026-06-12 | 38d2e6e1 | 229/4 | False | +4/-0 | 80 | SUPERADA_POR_MAIN | aheadBehind=229/4; cherryPlus=4; cherryMinus=0; files3=80; files2=1131; priority=P0 | no fusionar; main contiene implementaci?n final posterior |
| codex/operational-role-simulation | b1a728ac | 2026-05-19 | 186e8c2d | 798/10 | False | +10/-0 | 56 | REQUIERE_DECISION_USUARIO | aheadBehind=798/10; cherryPlus=10; cherryMinus=0; files3=56; files2=1760; priority=P0 | decisi?n humana/revisi?n focal antes de recuperaci?n |
| codex/production-readiness-preflight | ab17005d | 2026-06-08 | f02ab06a | 315/406 | False | +406/-0 | 769 | REQUIERE_DECISION_USUARIO | aheadBehind=315/406; cherryPlus=406; cherryMinus=0; files3=769; files2=1844; priority=P0 | decisi?n humana/revisi?n focal antes de recuperaci?n |
| codex/supply-chain-hardening | 86e52a6b | 2026-05-27 | 7f22a63b | 777/7 | False | +7/-0 | 65 | REQUIERE_DECISION_USUARIO | aheadBehind=777/7; cherryPlus=7; cherryMinus=0; files3=65; files2=1696; priority=P0 | decisi?n humana/revisi?n focal antes de recuperaci?n |
| fix/f8-audit-hardening-2026-06-14 | 81d74d6e | 2026-06-14 | 23659b3e | 181/5 | False | +5/-0 | 47 | REQUIERE_DECISION_USUARIO | aheadBehind=181/5; cherryPlus=5; cherryMinus=0; files3=47; files2=871; priority=P0 | decisi?n humana/revisi?n focal antes de recuperaci?n |
| hardening-audit-complete-2026-06-15 | 6cecb4af | 2026-06-15 | 605d2bca | 104/4 | False | +3/-1 | 85 | REQUIERE_DECISION_USUARIO | aheadBehind=104/4; cherryPlus=3; cherryMinus=1; files3=85; files2=605; priority=P0 | decisi?n humana/revisi?n focal antes de recuperaci?n |
| merge/f6-approved-a9377e9f | c851057f | 2026-06-14 | a9377e9f | 203/1 | False | +1/-0 | 3 | DUPLICADO_DE_OTRA_RAMA | aheadBehind=203/1; cherryPlus=1; cherryMinus=0; files3=3; files2=890; priority=P0; duplicateShaOf=audit/f6-post-approval-sensitive-c851057f | no recuperar como unidad; duplicado de referencia preservada |
| rescue/no-perder-nada-20260615-171019/stash/0 | 17f9fb57 | 2026-06-14 | e58270ff | 199/2 | False | +1/-0 | 22 | RESCATE_CONSERVAR | aheadBehind=199/2; cherryPlus=1; cherryMinus=0; files3=22; files2=883; priority=P1 | conservar como rescate; agrupar por duplicados antes de cualquier limpieza futura |
| rescue/no-perder-nada-20260615-171019/stash/1 | 62308c6f | 2026-06-14 | a9377e9f | 203/3 | False | +2/-0 | 0 | RESCATE_CONSERVAR | aheadBehind=203/3; cherryPlus=2; cherryMinus=0; files3=0; files2=888; priority=P2 | conservar como rescate; agrupar por duplicados antes de cualquier limpieza futura |
| rescue/no-perder-nada-20260615-171019/stash/10 | e5db50b1 | 2026-06-02 | ec061a60 | 333/3 | False | +2/-0 | 1 | RESCATE_CONSERVAR | aheadBehind=333/3; cherryPlus=2; cherryMinus=0; files3=1; files2=1359; priority=P1 | conservar como rescate; agrupar por duplicados antes de cualquier limpieza futura |
| rescue/no-perder-nada-20260615-171019/stash/11 | d53627a8 | 2026-06-02 | ec061a60 | 333/3 | False | +2/-0 | 8 | RESCATE_CONSERVAR | aheadBehind=333/3; cherryPlus=2; cherryMinus=0; files3=8; files2=1358; priority=P0 | conservar como rescate; agrupar por duplicados antes de cualquier limpieza futura |
| rescue/no-perder-nada-20260615-171019/stash/12 | 74dfa24b | 2026-06-01 | 15bcd6a1 | 559/2 | False | +1/-0 | 1 | RESCATE_CONSERVAR | aheadBehind=559/2; cherryPlus=1; cherryMinus=0; files3=1; files2=1515; priority=P1 | conservar como rescate; agrupar por duplicados antes de cualquier limpieza futura |
| rescue/no-perder-nada-20260615-171019/stash/13 | adc0d6ce | 2026-06-01 | 15bcd6a1 | 559/2 | False | +1/-0 | 1 | RESCATE_CONSERVAR | aheadBehind=559/2; cherryPlus=1; cherryMinus=0; files3=1; files2=1515; priority=P1 | conservar como rescate; agrupar por duplicados antes de cualquier limpieza futura |
| rescue/no-perder-nada-20260615-171019/stash/14 | 6a8d22e4 | 2026-06-01 | 15bcd6a1 | 559/2 | False | +1/-0 | 1 | RESCATE_CONSERVAR | aheadBehind=559/2; cherryPlus=1; cherryMinus=0; files3=1; files2=1515; priority=P1 | conservar como rescate; agrupar por duplicados antes de cualquier limpieza futura |
| rescue/no-perder-nada-20260615-171019/stash/15 | 1956dc0f | 2026-06-01 | 15bcd6a1 | 559/2 | False | +1/-0 | 2 | RESCATE_CONSERVAR | aheadBehind=559/2; cherryPlus=1; cherryMinus=0; files3=2; files2=1515; priority=P1 | conservar como rescate; agrupar por duplicados antes de cualquier limpieza futura |
| rescue/no-perder-nada-20260615-171019/stash/16 | 00a0b625 | 2026-05-19 | 186e8c2d | 798/3 | False | +2/-0 | 3 | RESCATE_CONSERVAR | aheadBehind=798/3; cherryPlus=2; cherryMinus=0; files3=3; files2=1760; priority=P1 | conservar como rescate; agrupar por duplicados antes de cualquier limpieza futura |
| rescue/no-perder-nada-20260615-171019/stash/17 | 1010a345 | 2026-05-19 | 186e8c2d | 798/2 | False | +1/-0 | 1 | RESCATE_CONSERVAR | aheadBehind=798/2; cherryPlus=1; cherryMinus=0; files3=1; files2=1760; priority=P2 | conservar como rescate; agrupar por duplicados antes de cualquier limpieza futura |
| rescue/no-perder-nada-20260615-171019/stash/18 | 6b2f004d | 2026-05-19 | 186e8c2d | 798/3 | False | +2/-0 | 20 | RESCATE_CONSERVAR | aheadBehind=798/3; cherryPlus=2; cherryMinus=0; files3=20; files2=1760; priority=P0 | conservar como rescate; agrupar por duplicados antes de cualquier limpieza futura |
| rescue/no-perder-nada-20260615-171019/stash/19 | db3a3280 | 2026-05-19 | 186e8c2d | 798/2 | False | +1/-0 | 1 | RESCATE_CONSERVAR | aheadBehind=798/2; cherryPlus=1; cherryMinus=0; files3=1; files2=1760; priority=P2 | conservar como rescate; agrupar por duplicados antes de cualquier limpieza futura |
| rescue/no-perder-nada-20260615-171019/stash/2 | b0791cba | 2026-06-14 | a9377e9f | 203/2 | False | +1/-0 | 1 | RESCATE_CONSERVAR | aheadBehind=203/2; cherryPlus=1; cherryMinus=0; files3=1; files2=888; priority=P1 | conservar como rescate; agrupar por duplicados antes de cualquier limpieza futura |
| rescue/no-perder-nada-20260615-171019/stash/20 | 3174b52f | 2026-05-19 | 186e8c2d | 798/2 | False | +1/-0 | 1 | RESCATE_CONSERVAR | aheadBehind=798/2; cherryPlus=1; cherryMinus=0; files3=1; files2=1760; priority=P2 | conservar como rescate; agrupar por duplicados antes de cualquier limpieza futura |
| rescue/no-perder-nada-20260615-171019/stash/21 | 95e0f529 | 2026-05-19 | 186e8c2d | 798/4 | False | +3/-0 | 9 | RESCATE_CONSERVAR | aheadBehind=798/4; cherryPlus=3; cherryMinus=0; files3=9; files2=1760; priority=P0 | conservar como rescate; agrupar por duplicados antes de cualquier limpieza futura |
| rescue/no-perder-nada-20260615-171019/stash/22 | 813c221b | 2026-05-19 | 186e8c2d | 798/3 | False | +2/-0 | 15 | RESCATE_CONSERVAR | aheadBehind=798/3; cherryPlus=2; cherryMinus=0; files3=15; files2=1760; priority=P0 | conservar como rescate; agrupar por duplicados antes de cualquier limpieza futura |
| rescue/no-perder-nada-20260615-171019/stash/23 | c433cd1b | 2026-05-19 | 186e8c2d | 798/3 | False | +2/-0 | 3 | RESCATE_CONSERVAR | aheadBehind=798/3; cherryPlus=2; cherryMinus=0; files3=3; files2=1760; priority=P1 | conservar como rescate; agrupar por duplicados antes de cualquier limpieza futura |
| rescue/no-perder-nada-20260615-171019/stash/24 | c6ae34f3 | 2026-05-19 | 186e8c2d | 798/2 | False | +1/-0 | 1 | RESCATE_CONSERVAR | aheadBehind=798/2; cherryPlus=1; cherryMinus=0; files3=1; files2=1760; priority=P1 | conservar como rescate; agrupar por duplicados antes de cualquier limpieza futura |
| rescue/no-perder-nada-20260615-171019/stash/25 | 1efa365b | 2026-05-19 | 186e8c2d | 798/3 | False | +2/-0 | 12 | RESCATE_CONSERVAR | aheadBehind=798/3; cherryPlus=2; cherryMinus=0; files3=12; files2=1760; priority=P0 | conservar como rescate; agrupar por duplicados antes de cualquier limpieza futura |
| rescue/no-perder-nada-20260615-171019/stash/26 | dbc961de | 2026-05-19 | 186e8c2d | 798/3 | False | +2/-0 | 8 | RESCATE_CONSERVAR | aheadBehind=798/3; cherryPlus=2; cherryMinus=0; files3=8; files2=1760; priority=P0 | conservar como rescate; agrupar por duplicados antes de cualquier limpieza futura |
| rescue/no-perder-nada-20260615-171019/stash/27 | 6ca25f2d | 2026-05-19 | 186e8c2d | 798/3 | False | +2/-0 | 2 | RESCATE_CONSERVAR | aheadBehind=798/3; cherryPlus=2; cherryMinus=0; files3=2; files2=1760; priority=P1 | conservar como rescate; agrupar por duplicados antes de cualquier limpieza futura |
| rescue/no-perder-nada-20260615-171019/stash/28 | a4da086e | 2026-05-19 | 186e8c2d | 798/2 | False | +1/-0 | 1 | RESCATE_CONSERVAR | aheadBehind=798/2; cherryPlus=1; cherryMinus=0; files3=1; files2=1760; priority=P1 | conservar como rescate; agrupar por duplicados antes de cualquier limpieza futura |
| rescue/no-perder-nada-20260615-171019/stash/29 | 74fb4928 | 2026-05-19 | 186e8c2d | 798/3 | False | +2/-0 | 5 | RESCATE_CONSERVAR | aheadBehind=798/3; cherryPlus=2; cherryMinus=0; files3=5; files2=1760; priority=P1 | conservar como rescate; agrupar por duplicados antes de cualquier limpieza futura |
| rescue/no-perder-nada-20260615-171019/stash/3 | 186623e4 | 2026-06-11 | be089042 | 251/3 | False | +2/-0 | 33 | RESCATE_CONSERVAR | aheadBehind=251/3; cherryPlus=2; cherryMinus=0; files3=33; files2=1187; priority=P0 | conservar como rescate; agrupar por duplicados antes de cualquier limpieza futura |
| rescue/no-perder-nada-20260615-171019/stash/30 | ba43481f | 2026-05-19 | 186e8c2d | 798/4 | False | +3/-0 | 11 | RESCATE_CONSERVAR | aheadBehind=798/4; cherryPlus=3; cherryMinus=0; files3=11; files2=1760; priority=P0 | conservar como rescate; agrupar por duplicados antes de cualquier limpieza futura |
| rescue/no-perder-nada-20260615-171019/stash/31 | 48ce8b42 | 2026-05-19 | 186e8c2d | 798/4 | False | +3/-0 | 10 | RESCATE_CONSERVAR | aheadBehind=798/4; cherryPlus=3; cherryMinus=0; files3=10; files2=1760; priority=P0 | conservar como rescate; agrupar por duplicados antes de cualquier limpieza futura |
| rescue/no-perder-nada-20260615-171019/stash/32 | 26190426 | 2026-05-19 | 186e8c2d | 798/4 | False | +3/-0 | 12 | RESCATE_CONSERVAR | aheadBehind=798/4; cherryPlus=3; cherryMinus=0; files3=12; files2=1760; priority=P0 | conservar como rescate; agrupar por duplicados antes de cualquier limpieza futura |
| rescue/no-perder-nada-20260615-171019/stash/33 | 633db4f8 | 2026-05-19 | 186e8c2d | 798/3 | False | +2/-0 | 11 | RESCATE_CONSERVAR | aheadBehind=798/3; cherryPlus=2; cherryMinus=0; files3=11; files2=1760; priority=P0 | conservar como rescate; agrupar por duplicados antes de cualquier limpieza futura |
| rescue/no-perder-nada-20260615-171019/stash/34 | 5ce6590f | 2026-05-19 | 186e8c2d | 798/4 | False | +3/-0 | 25 | RESCATE_CONSERVAR | aheadBehind=798/4; cherryPlus=3; cherryMinus=0; files3=25; files2=1760; priority=P0 | conservar como rescate; agrupar por duplicados antes de cualquier limpieza futura |
| rescue/no-perder-nada-20260615-171019/stash/4 | 94c6ab95 | 2026-06-09 | c431d5dd | 309/2 | False | +1/-0 | 21 | RESCATE_CONSERVAR | aheadBehind=309/2; cherryPlus=1; cherryMinus=0; files3=21; files2=1340; priority=P0 | conservar como rescate; agrupar por duplicados antes de cualquier limpieza futura |
| rescue/no-perder-nada-20260615-171019/stash/5 | bd056235 | 2026-06-03 | f02ab06a | 315/82 | False | +81/-0 | 215 | RESCATE_CONSERVAR | aheadBehind=315/82; cherryPlus=81; cherryMinus=0; files3=215; files2=1464; priority=P0 | conservar como rescate; agrupar por duplicados antes de cualquier limpieza futura |
| rescue/no-perder-nada-20260615-171019/stash/6 | 67ec8c3c | 2026-06-02 | c72dad8c | 323/3 | False | +1/-1 | 3 | RESCATE_CONSERVAR | aheadBehind=323/3; cherryPlus=1; cherryMinus=1; files3=3; files2=1351; priority=P1 | conservar como rescate; agrupar por duplicados antes de cualquier limpieza futura |
| rescue/no-perder-nada-20260615-171019/stash/7 | 3ab1d5b4 | 2026-06-02 | c72dad8c | 323/3 | False | +2/-0 | 3 | RESCATE_CONSERVAR | aheadBehind=323/3; cherryPlus=2; cherryMinus=0; files3=3; files2=1351; priority=P0 | conservar como rescate; agrupar por duplicados antes de cualquier limpieza futura |
| rescue/no-perder-nada-20260615-171019/stash/8 | 56540af7 | 2026-06-02 | 6517f9d0 | 331/3 | False | +2/-0 | 0 | RESCATE_CONSERVAR | aheadBehind=331/3; cherryPlus=2; cherryMinus=0; files3=0; files2=1357; priority=P2 | conservar como rescate; agrupar por duplicados antes de cualquier limpieza futura |
| rescue/no-perder-nada-20260615-171019/stash/9 | 3b7ba595 | 2026-06-02 | 6517f9d0 | 331/2 | False | +1/-0 | 2 | RESCATE_CONSERVAR | aheadBehind=331/2; cherryPlus=1; cherryMinus=0; files3=2; files2=1357; priority=P0 | conservar como rescate; agrupar por duplicados antes de cualquier limpieza futura |
| rescue/no-perder-nada-20260615-171019/uncommitted/004-C-/tmp/S_Hospital_f6_global_design | fc76059c | 2026-06-15 | 38d2e6e1 | 229/1 | False | +1/-0 | 149 | RESCATE_CONSERVAR | aheadBehind=229/1; cherryPlus=1; cherryMinus=0; files3=149; files2=1182; priority=P0 | conservar como rescate; agrupar por duplicados antes de cualquier limpieza futura |
| rescue/no-perder-nada-20260615-171019/uncommitted/009-C-/tmp/S_Hospital_release_12062039 | 635ecb17 | 2026-06-15 | 12062039 | 338/1 | False | +1/-0 | 454 | RESCATE_CONSERVAR | aheadBehind=338/1; cherryPlus=1; cherryMinus=0; files3=454; files2=1576; priority=P0 | conservar como rescate; agrupar por duplicados antes de cualquier limpieza futura |
| rescue/no-perder-nada-20260615-171019/uncommitted/052-C-/tmp/S_Hospital_verify_b2fe0b43 | 9725daf3 | 2026-06-15 | b2fe0b43 | 389/1 | False | +1/-0 | 440 | RESCATE_CONSERVAR | aheadBehind=389/1; cherryPlus=1; cherryMinus=0; files3=440; files2=1607; priority=P0 | conservar como rescate; agrupar por duplicados antes de cualquier limpieza futura |
| rescue/no-perder-nada-20260615-171019/worktree-head/005-C-/tmp/S_Hospital_final_rc | 70df4b7e | 2026-06-12 | 38d2e6e1 | 229/4 | False | +4/-0 | 80 | RESCATE_CONSERVAR | aheadBehind=229/4; cherryPlus=4; cherryMinus=0; files3=80; files2=1131; priority=P0 | conservar como rescate; agrupar por duplicados antes de cualquier limpieza futura |
| rescue/no-perder-nada-20260615-180121/stash/0 | 17f9fb57 | 2026-06-14 | e58270ff | 199/2 | False | +1/-0 | 22 | RESCATE_CONSERVAR | aheadBehind=199/2; cherryPlus=1; cherryMinus=0; files3=22; files2=883; priority=P1 | conservar como rescate; agrupar por duplicados antes de cualquier limpieza futura |
| rescue/no-perder-nada-20260615-180121/stash/1 | 62308c6f | 2026-06-14 | a9377e9f | 203/3 | False | +2/-0 | 0 | RESCATE_CONSERVAR | aheadBehind=203/3; cherryPlus=2; cherryMinus=0; files3=0; files2=888; priority=P2 | conservar como rescate; agrupar por duplicados antes de cualquier limpieza futura |
| rescue/no-perder-nada-20260615-180121/stash/10 | e5db50b1 | 2026-06-02 | ec061a60 | 333/3 | False | +2/-0 | 1 | RESCATE_CONSERVAR | aheadBehind=333/3; cherryPlus=2; cherryMinus=0; files3=1; files2=1359; priority=P1 | conservar como rescate; agrupar por duplicados antes de cualquier limpieza futura |
| rescue/no-perder-nada-20260615-180121/stash/11 | d53627a8 | 2026-06-02 | ec061a60 | 333/3 | False | +2/-0 | 8 | RESCATE_CONSERVAR | aheadBehind=333/3; cherryPlus=2; cherryMinus=0; files3=8; files2=1358; priority=P0 | conservar como rescate; agrupar por duplicados antes de cualquier limpieza futura |
| rescue/no-perder-nada-20260615-180121/stash/12 | 74dfa24b | 2026-06-01 | 15bcd6a1 | 559/2 | False | +1/-0 | 1 | RESCATE_CONSERVAR | aheadBehind=559/2; cherryPlus=1; cherryMinus=0; files3=1; files2=1515; priority=P1 | conservar como rescate; agrupar por duplicados antes de cualquier limpieza futura |
| rescue/no-perder-nada-20260615-180121/stash/13 | adc0d6ce | 2026-06-01 | 15bcd6a1 | 559/2 | False | +1/-0 | 1 | RESCATE_CONSERVAR | aheadBehind=559/2; cherryPlus=1; cherryMinus=0; files3=1; files2=1515; priority=P1 | conservar como rescate; agrupar por duplicados antes de cualquier limpieza futura |
| rescue/no-perder-nada-20260615-180121/stash/14 | 6a8d22e4 | 2026-06-01 | 15bcd6a1 | 559/2 | False | +1/-0 | 1 | RESCATE_CONSERVAR | aheadBehind=559/2; cherryPlus=1; cherryMinus=0; files3=1; files2=1515; priority=P1 | conservar como rescate; agrupar por duplicados antes de cualquier limpieza futura |
| rescue/no-perder-nada-20260615-180121/stash/15 | 1956dc0f | 2026-06-01 | 15bcd6a1 | 559/2 | False | +1/-0 | 2 | RESCATE_CONSERVAR | aheadBehind=559/2; cherryPlus=1; cherryMinus=0; files3=2; files2=1515; priority=P1 | conservar como rescate; agrupar por duplicados antes de cualquier limpieza futura |
| rescue/no-perder-nada-20260615-180121/stash/16 | 00a0b625 | 2026-05-19 | 186e8c2d | 798/3 | False | +2/-0 | 3 | RESCATE_CONSERVAR | aheadBehind=798/3; cherryPlus=2; cherryMinus=0; files3=3; files2=1760; priority=P1 | conservar como rescate; agrupar por duplicados antes de cualquier limpieza futura |
| rescue/no-perder-nada-20260615-180121/stash/17 | 1010a345 | 2026-05-19 | 186e8c2d | 798/2 | False | +1/-0 | 1 | RESCATE_CONSERVAR | aheadBehind=798/2; cherryPlus=1; cherryMinus=0; files3=1; files2=1760; priority=P2 | conservar como rescate; agrupar por duplicados antes de cualquier limpieza futura |
| rescue/no-perder-nada-20260615-180121/stash/18 | 6b2f004d | 2026-05-19 | 186e8c2d | 798/3 | False | +2/-0 | 20 | RESCATE_CONSERVAR | aheadBehind=798/3; cherryPlus=2; cherryMinus=0; files3=20; files2=1760; priority=P0 | conservar como rescate; agrupar por duplicados antes de cualquier limpieza futura |
| rescue/no-perder-nada-20260615-180121/stash/19 | db3a3280 | 2026-05-19 | 186e8c2d | 798/2 | False | +1/-0 | 1 | RESCATE_CONSERVAR | aheadBehind=798/2; cherryPlus=1; cherryMinus=0; files3=1; files2=1760; priority=P2 | conservar como rescate; agrupar por duplicados antes de cualquier limpieza futura |
| rescue/no-perder-nada-20260615-180121/stash/2 | b0791cba | 2026-06-14 | a9377e9f | 203/2 | False | +1/-0 | 1 | RESCATE_CONSERVAR | aheadBehind=203/2; cherryPlus=1; cherryMinus=0; files3=1; files2=888; priority=P1 | conservar como rescate; agrupar por duplicados antes de cualquier limpieza futura |
| rescue/no-perder-nada-20260615-180121/stash/20 | 3174b52f | 2026-05-19 | 186e8c2d | 798/2 | False | +1/-0 | 1 | RESCATE_CONSERVAR | aheadBehind=798/2; cherryPlus=1; cherryMinus=0; files3=1; files2=1760; priority=P2 | conservar como rescate; agrupar por duplicados antes de cualquier limpieza futura |
| rescue/no-perder-nada-20260615-180121/stash/21 | 95e0f529 | 2026-05-19 | 186e8c2d | 798/4 | False | +3/-0 | 9 | RESCATE_CONSERVAR | aheadBehind=798/4; cherryPlus=3; cherryMinus=0; files3=9; files2=1760; priority=P0 | conservar como rescate; agrupar por duplicados antes de cualquier limpieza futura |
| rescue/no-perder-nada-20260615-180121/stash/22 | 813c221b | 2026-05-19 | 186e8c2d | 798/3 | False | +2/-0 | 15 | RESCATE_CONSERVAR | aheadBehind=798/3; cherryPlus=2; cherryMinus=0; files3=15; files2=1760; priority=P0 | conservar como rescate; agrupar por duplicados antes de cualquier limpieza futura |
| rescue/no-perder-nada-20260615-180121/stash/23 | c433cd1b | 2026-05-19 | 186e8c2d | 798/3 | False | +2/-0 | 3 | RESCATE_CONSERVAR | aheadBehind=798/3; cherryPlus=2; cherryMinus=0; files3=3; files2=1760; priority=P1 | conservar como rescate; agrupar por duplicados antes de cualquier limpieza futura |
| rescue/no-perder-nada-20260615-180121/stash/24 | c6ae34f3 | 2026-05-19 | 186e8c2d | 798/2 | False | +1/-0 | 1 | RESCATE_CONSERVAR | aheadBehind=798/2; cherryPlus=1; cherryMinus=0; files3=1; files2=1760; priority=P1 | conservar como rescate; agrupar por duplicados antes de cualquier limpieza futura |
| rescue/no-perder-nada-20260615-180121/stash/25 | 1efa365b | 2026-05-19 | 186e8c2d | 798/3 | False | +2/-0 | 12 | RESCATE_CONSERVAR | aheadBehind=798/3; cherryPlus=2; cherryMinus=0; files3=12; files2=1760; priority=P0 | conservar como rescate; agrupar por duplicados antes de cualquier limpieza futura |
| rescue/no-perder-nada-20260615-180121/stash/26 | dbc961de | 2026-05-19 | 186e8c2d | 798/3 | False | +2/-0 | 8 | RESCATE_CONSERVAR | aheadBehind=798/3; cherryPlus=2; cherryMinus=0; files3=8; files2=1760; priority=P0 | conservar como rescate; agrupar por duplicados antes de cualquier limpieza futura |
| rescue/no-perder-nada-20260615-180121/stash/27 | 6ca25f2d | 2026-05-19 | 186e8c2d | 798/3 | False | +2/-0 | 2 | RESCATE_CONSERVAR | aheadBehind=798/3; cherryPlus=2; cherryMinus=0; files3=2; files2=1760; priority=P1 | conservar como rescate; agrupar por duplicados antes de cualquier limpieza futura |
| rescue/no-perder-nada-20260615-180121/stash/28 | a4da086e | 2026-05-19 | 186e8c2d | 798/2 | False | +1/-0 | 1 | RESCATE_CONSERVAR | aheadBehind=798/2; cherryPlus=1; cherryMinus=0; files3=1; files2=1760; priority=P1 | conservar como rescate; agrupar por duplicados antes de cualquier limpieza futura |
| rescue/no-perder-nada-20260615-180121/stash/29 | 74fb4928 | 2026-05-19 | 186e8c2d | 798/3 | False | +2/-0 | 5 | RESCATE_CONSERVAR | aheadBehind=798/3; cherryPlus=2; cherryMinus=0; files3=5; files2=1760; priority=P1 | conservar como rescate; agrupar por duplicados antes de cualquier limpieza futura |
| rescue/no-perder-nada-20260615-180121/stash/3 | 186623e4 | 2026-06-11 | be089042 | 251/3 | False | +2/-0 | 33 | RESCATE_CONSERVAR | aheadBehind=251/3; cherryPlus=2; cherryMinus=0; files3=33; files2=1187; priority=P0 | conservar como rescate; agrupar por duplicados antes de cualquier limpieza futura |
| rescue/no-perder-nada-20260615-180121/stash/30 | ba43481f | 2026-05-19 | 186e8c2d | 798/4 | False | +3/-0 | 11 | RESCATE_CONSERVAR | aheadBehind=798/4; cherryPlus=3; cherryMinus=0; files3=11; files2=1760; priority=P0 | conservar como rescate; agrupar por duplicados antes de cualquier limpieza futura |
| rescue/no-perder-nada-20260615-180121/stash/31 | 48ce8b42 | 2026-05-19 | 186e8c2d | 798/4 | False | +3/-0 | 10 | RESCATE_CONSERVAR | aheadBehind=798/4; cherryPlus=3; cherryMinus=0; files3=10; files2=1760; priority=P0 | conservar como rescate; agrupar por duplicados antes de cualquier limpieza futura |
| rescue/no-perder-nada-20260615-180121/stash/32 | 26190426 | 2026-05-19 | 186e8c2d | 798/4 | False | +3/-0 | 12 | RESCATE_CONSERVAR | aheadBehind=798/4; cherryPlus=3; cherryMinus=0; files3=12; files2=1760; priority=P0 | conservar como rescate; agrupar por duplicados antes de cualquier limpieza futura |
| rescue/no-perder-nada-20260615-180121/stash/33 | 633db4f8 | 2026-05-19 | 186e8c2d | 798/3 | False | +2/-0 | 11 | RESCATE_CONSERVAR | aheadBehind=798/3; cherryPlus=2; cherryMinus=0; files3=11; files2=1760; priority=P0 | conservar como rescate; agrupar por duplicados antes de cualquier limpieza futura |
| rescue/no-perder-nada-20260615-180121/stash/34 | 5ce6590f | 2026-05-19 | 186e8c2d | 798/4 | False | +3/-0 | 25 | RESCATE_CONSERVAR | aheadBehind=798/4; cherryPlus=3; cherryMinus=0; files3=25; files2=1760; priority=P0 | conservar como rescate; agrupar por duplicados antes de cualquier limpieza futura |
| rescue/no-perder-nada-20260615-180121/stash/4 | 94c6ab95 | 2026-06-09 | c431d5dd | 309/2 | False | +1/-0 | 21 | RESCATE_CONSERVAR | aheadBehind=309/2; cherryPlus=1; cherryMinus=0; files3=21; files2=1340; priority=P0 | conservar como rescate; agrupar por duplicados antes de cualquier limpieza futura |
| rescue/no-perder-nada-20260615-180121/stash/5 | bd056235 | 2026-06-03 | f02ab06a | 315/82 | False | +81/-0 | 215 | RESCATE_CONSERVAR | aheadBehind=315/82; cherryPlus=81; cherryMinus=0; files3=215; files2=1464; priority=P0 | conservar como rescate; agrupar por duplicados antes de cualquier limpieza futura |
| rescue/no-perder-nada-20260615-180121/stash/6 | 67ec8c3c | 2026-06-02 | c72dad8c | 323/3 | False | +1/-1 | 3 | RESCATE_CONSERVAR | aheadBehind=323/3; cherryPlus=1; cherryMinus=1; files3=3; files2=1351; priority=P1 | conservar como rescate; agrupar por duplicados antes de cualquier limpieza futura |
| rescue/no-perder-nada-20260615-180121/stash/7 | 3ab1d5b4 | 2026-06-02 | c72dad8c | 323/3 | False | +2/-0 | 3 | RESCATE_CONSERVAR | aheadBehind=323/3; cherryPlus=2; cherryMinus=0; files3=3; files2=1351; priority=P0 | conservar como rescate; agrupar por duplicados antes de cualquier limpieza futura |
| rescue/no-perder-nada-20260615-180121/stash/8 | 56540af7 | 2026-06-02 | 6517f9d0 | 331/3 | False | +2/-0 | 0 | RESCATE_CONSERVAR | aheadBehind=331/3; cherryPlus=2; cherryMinus=0; files3=0; files2=1357; priority=P2 | conservar como rescate; agrupar por duplicados antes de cualquier limpieza futura |
| rescue/no-perder-nada-20260615-180121/stash/9 | 3b7ba595 | 2026-06-02 | 6517f9d0 | 331/2 | False | +1/-0 | 2 | RESCATE_CONSERVAR | aheadBehind=331/2; cherryPlus=1; cherryMinus=0; files3=2; files2=1357; priority=P0 | conservar como rescate; agrupar por duplicados antes de cualquier limpieza futura |
| rescue/no-perder-nada-20260615-180121/uncommitted/004 | 950391d9 | 2026-06-15 | 38d2e6e1 | 229/1 | False | +1/-0 | 149 | RESCATE_CONSERVAR | aheadBehind=229/1; cherryPlus=1; cherryMinus=0; files3=149; files2=1182; priority=P0 | conservar como rescate; agrupar por duplicados antes de cualquier limpieza futura |
| rescue/no-perder-nada-20260615-180121/uncommitted/009 | 3658e2d1 | 2026-06-15 | 12062039 | 338/1 | False | +1/-0 | 453 | RESCATE_CONSERVAR | aheadBehind=338/1; cherryPlus=1; cherryMinus=0; files3=453; files2=1575; priority=P0 | conservar como rescate; agrupar por duplicados antes de cualquier limpieza futura |
| rescue/no-perder-nada-20260615-180121/uncommitted/052 | c7d0a61e | 2026-06-15 | b2fe0b43 | 389/1 | False | +1/-0 | 439 | RESCATE_CONSERVAR | aheadBehind=389/1; cherryPlus=1; cherryMinus=0; files3=439; files2=1606; priority=P0 | conservar como rescate; agrupar por duplicados antes de cualquier limpieza futura |
| rescue/no-perder-nada-20260615-180121/worktree-head/005- | 70df4b7e | 2026-06-12 | 38d2e6e1 | 229/4 | False | +4/-0 | 80 | RESCATE_CONSERVAR | aheadBehind=229/4; cherryPlus=4; cherryMinus=0; files3=80; files2=1131; priority=P0 | conservar como rescate; agrupar por duplicados antes de cualquier limpieza futura |

## Trabajo util ausente

No se recupero ni se valido automaticamente ningun cambio sobre main. No hubo candidato que cumpliera simultaneamente: utilidad comprobada, compatibilidad con la arquitectura actual, ausencia de artefactos/sensibles, y necesidad demostrada frente al main final. Las ramas siguientes contienen intenciones que podrian requerir decision humana si se reabre el proyecto:

### audit/f6-post-approval-sensitive-a979d5b7

- Commits exclusivos: 1.
- Archivos tocados: 17; tests: 4; scripts: 0; migraciones: 1.
- Archivos ya presentes por ruta en main: 14.
- Archivos ausentes por ruta (muestra): backend/database/migrations/2026_06_14_000002_encrypt_legacy_idempotency_keys.php; backend/tests/Feature/EncryptLegacyIdempotencyKeysTest.php; backend/tests/Feature/RestrictInvoiceItemsInvoiceDeleteTest.php
- Problema/intencion inferida: a979d5b7 refactor: enhance invoice and payment voiding logic with cash session checks and improve error handling
- Riesgo: rama atrasada respecto de main; fusionarla completa revertiria o duplicaria trabajo final.
- Prueba existente: indicada en conteo si aplica; no ejecutada porque no se porto codigo.
- Resultado de evaluacion: revision estatica; no se creo recovery-eval porque no hubo candidato comprobado como seguro y necesario.
- Recomendacion: decision de usuario antes de recuperar.

### audit/f6-post-approval-sensitive-c851057f

- Commits exclusivos: 1.
- Archivos tocados: 3; tests: 1; scripts: 1; migraciones: 1.
- Archivos ya presentes por ruta en main: 1.
- Archivos ausentes por ruta (muestra): backend/database/migrations/2026_06_14_000000_encrypt_idempotency_keys.php; backend/tests/Feature/EncryptLegacyIdempotencyKeysTest.php
- Problema/intencion inferida: c851057f fix(security): natively encrypt legacy plaintext idempotency keys
- Riesgo: rama atrasada respecto de main; fusionarla completa revertiria o duplicaria trabajo final.
- Prueba existente: indicada en conteo si aplica; no ejecutada porque no se porto codigo.
- Resultado de evaluacion: revision estatica; no se creo recovery-eval porque no hubo candidato comprobado como seguro y necesario.
- Recomendacion: decision de usuario antes de recuperar.

### codex/operational-role-simulation

- Commits exclusivos: 10.
- Archivos tocados: 56; tests: 5; scripts: 7; migraciones: 0.
- Archivos ya presentes por ruta en main: 56.
- Archivos ausentes por ruta (muestra): 
- Problema/intencion inferida: b1a728ac fix(backups): persist current-user automation startup | e2e643f2 fix(backups): add current-user startup automation | e516b590 chore(backups): add windows backup wrappers | d6d49cf9 fix(backups): find local mysql dump binary | d66f3e75 fix(backups): schedule daily local backups | b659ba62 fix(invoices): keep paid invoices discoverable from POS | 5377f0e4 fix(pos): clarify payment and receipt workflow | 6e941a94 fix(pos): harden operational workflow readiness | 6c2cc325 fix(reports): harden admin permissions and exports UX | a6f4f36c fix(cash): clarify close-session and receipt workflow
- Riesgo: rama atrasada respecto de main; fusionarla completa revertiria o duplicaria trabajo final.
- Prueba existente: indicada en conteo si aplica; no ejecutada porque no se porto codigo.
- Resultado de evaluacion: revision estatica; no se creo recovery-eval porque no hubo candidato comprobado como seguro y necesario.
- Recomendacion: no fusionar; archivos existen en main y la rama esta muy atrasada.

### codex/production-readiness-preflight

- Commits exclusivos: 406.
- Archivos tocados: 769; tests: 123; scripts: 78; migraciones: 46.
- Archivos ya presentes por ruta en main: 490.
- Archivos ausentes por ruta (muestra): .github/PULL_REQUEST_TEMPLATE.md; CODE_OF_CONDUCT.md; CONTRIBUTING.md; RELEASE_NOTES_v1.0.0_FINAL.md; SECURITY.md; backend/app/Actions/Reports/AreaPaidServicesReportService.php; backend/app/Actions/Reports/InstitutionalExcelExportService.php; backend/app/Http/Controllers/InvoiceAuditController.php; backend/app/Http/Controllers/PatientInvoiceController.php; backend/app/Http/Requests/Billing/PatientSummaryRequest.php; backend/app/Http/Requests/Reports/AreaPaidServicesRequest.php; backend/app/Support/LempiraAmountWords.php
- Problema/intencion inferida: ab17005d docs(qa): record handoff evidence review | bde5874a docs(qa): refresh handoff release authority evidence | f6a0b40d docs(qa): record handoff release authority review | 7ba4d020 fix(ops): validate handoff release authority | 67b70744 docs(qa): record handoff refresh review | 8e4ddb97 docs(qa): refresh production handoff evidence | 25fe010d docs(qa): record catalog identifier review | 219496d5 fix(catalog): hide service identifier values in list | 61324fd0 docs(qa): record handoff guard review | 8e12f22e fix(ops): restore handoff safety guards | b84183bc docs(qa): record dynamic total smoke review | 4912f9cc test(smoke): collect visible invoice total
- Riesgo: rama atrasada respecto de main; fusionarla completa revertiria o duplicaria trabajo final.
- Prueba existente: indicada en conteo si aplica; no ejecutada porque no se porto codigo.
- Resultado de evaluacion: revision estatica; no se creo recovery-eval porque no hubo candidato comprobado como seguro y necesario.
- Recomendacion: no fusionar como rama; extraer intencion solo si producto reabre modulo legado.

### codex/supply-chain-hardening

- Commits exclusivos: 7.
- Archivos tocados: 65; tests: 7; scripts: 13; migraciones: 0.
- Archivos ya presentes por ruta en main: 50.
- Archivos ausentes por ruta (muestra): backend/.npmrc; backend/app/Http/Requests/Reports/PdfExportReportRequest.php; backend/app/Policies/CashRegisterSessionPolicy.php; backend/package-lock.json; "backend/public/C\357\200\272\357\201\234Projects\357\201\234S_Hospital\357\201\234backend\357\201\234storage\357\201\234framework\357\201\234views/275c7c02e2528e6029079c885e2d2418.php"; "backend/public/C\357\200\272\357\201\234Projects\357\201\234S_Hospital\357\201\234backend\357\201\234storage\357\201\234framework\357\201\234views/dd310000961f2d208873a737c27d849a.php"; backend/tests/Unit/Actions/AuditUserActionsTest.php; backend/tests/Unit/Actions/CalculateInvoiceTotalsTest.php; backend/tests/Unit/Actions/EritropoyetinaRuleTest.php; backend/tests/Unit/Actions/RegisterPaymentTest.php; docs/OFFLINE_INSTALL.md; docs/SECURITY_SUPPLY_CHAIN_RUNBOOK.md
- Problema/intencion inferida: 86e52a6b feat(deploy): implement robust network and docker preflight diagnostics v2 phase 1 | 93a36fd8 feat(deploy): implement offline release package bundler and image load integration for docker deployments | f25237c5 feat(deploy): configure docker-compose production environment and launch scripts for LAN deployment | a8a56c35 test(qa): harden production readiness preflight and e2e checks | dc53001c feat(security): harden backend policies and backup controls | ca8c199f feat(deploy): harden hospital LAN installer | 51450eb2 chore(security): add supply chain guard
- Riesgo: rama atrasada respecto de main; fusionarla completa revertiria o duplicaria trabajo final.
- Prueba existente: indicada en conteo si aplica; no ejecutada porque no se porto codigo.
- Resultado de evaluacion: revision estatica; no se creo recovery-eval porque no hubo candidato comprobado como seguro y necesario.
- Recomendacion: no fusionar como rama; contiene artefactos generados y arquitectura antigua.

### fix/f8-audit-hardening-2026-06-14

- Commits exclusivos: 5.
- Archivos tocados: 47; tests: 15; scripts: 6; migraciones: 1.
- Archivos ya presentes por ruta en main: 45.
- Archivos ausentes por ruta (muestra): backend/database/migrations/2026_06_14_000001_add_backup_protection_metadata_to_backup_logs.php; backend/tests/Unit/CashPaymentLockOrderTest.php
- Problema/intencion inferida: 81d74d6e fix(backend): satisfy hardening quality gates | a503ca5a fix(frontend): enforce receipt reprint reasons and safe catalog errors | 6a9d83ef fix(infra): require operational LAN health and realtime checks | b8688251 fix(backups): encrypt artifacts and harden retention | 44f45912 fix(backend): harden billing permissions and audit trails
- Riesgo: rama atrasada respecto de main; fusionarla completa revertiria o duplicaria trabajo final.
- Prueba existente: indicada en conteo si aplica; no ejecutada porque no se porto codigo.
- Resultado de evaluacion: revision estatica; no se creo recovery-eval porque no hubo candidato comprobado como seguro y necesario.
- Recomendacion: revisar manualmente test de lock order y metadatos de backup si operaciones lo solicita.

### hardening-audit-complete-2026-06-15

- Commits exclusivos: 4.
- Archivos tocados: 85; tests: 17; scripts: 8; migraciones: 3.
- Archivos ya presentes por ruta en main: 80.
- Archivos ausentes por ruta (muestra): docs/DATA_MIGRATION.md; docs/DATETIME_POLICY.md; docs/ENDPOINT_SECURITY.md; docs/MAINTENANCE_ROUTINE.md; docs/PHYSICAL_SECURITY.md
- Problema/intencion inferida: 6cecb4af Exclude vendored paths from offline dependency audit | 680e7d2e fix(release): harden audit backups receipts and document release truth | e2b11f45 docs(offline): add physical endpoint datetime migration maintenance docs | bf552ef7 docs(offline): add offline mode gap analysis and phased plan
- Riesgo: rama atrasada respecto de main; fusionarla completa revertiria o duplicaria trabajo final.
- Prueba existente: indicada en conteo si aplica; no ejecutada porque no se porto codigo.
- Resultado de evaluacion: revision estatica; no se creo recovery-eval porque no hubo candidato comprobado como seguro y necesario.
- Recomendacion: revisar manualmente docs offline faltantes; main ya referencia algunos en limitaciones.


Observaciones concretas:

- EncryptLegacyIdempotencyKeysCommand y su prueba equivalente ya existen en main bajo backend/tests/Feature/Console/EncryptLegacyIdempotencyKeysTest.php.
- RestrictInvoiceItemsInvoiceDeleteTest.php no existe por ruta en main; main conserva la migracion restrictiva y documentacion/auditoria relacionada. La prueba antigua depende de MySQL y se salta en SQLite, por lo que debe reimplementarse sobre el contrato actual si se considera necesaria.
- CashPaymentLockOrderTest.php no existe en main; la inspeccion de RegisterPaymentAction y CloseCashSessionAction muestra que main bloquea caja antes de facturas/pagos. La prueba ausente usa introspeccion de texto fuente, fragil ante refactors.
- docs/DATA_MIGRATION.md, docs/DATETIME_POLICY.md, docs/ENDPOINT_SECURITY.md, docs/MAINTENANCE_ROUTINE.md y docs/PHYSICAL_SECURITY.md no existen en main aunque KNOWN_LIMITATIONS.md/OFFLINE_MODE_PLAN.md los mencionan. Son candidatos documentales, no funcionales.
- La rama fix/f8-audit-hardening-2026-06-14 incluye una migracion de metadatos de backup_logs (format, compression, encrypted, encryption_key_id) que no existe en main. Main ya guarda checksum_sha256 y cifra backups, pero no conserva esos metadatos; recuperar esto requiere decision de producto y migracion nueva sobre el schema final.

## Worktrees sucios

### S_Hospital_f6_global_design

- Ruta: C:/tmp/S_Hospital_f6_global_design
- Rama/HEAD: codex/f6-global-institutional-design-refactor / 38d2e6e192616ce0e08052aec80a118f3c8ff4be
- Archivos cambiados: 149; untracked: 0.
- Posibles secretos/artefactos por ruta: 123; patrones sensibles en contenido: 8.
- Estado de preservacion: PRESERVACION MANUAL REQUERIDA. Parches rastreados guardados localmente en carpeta forense; worktree intacto.
- Rama archive creada: no creada. Push: no realizado.
- Accion pendiente: revision humana antes de cualquier commit o push de esos cambios.

### S_Hospital_release_12062039

- Ruta: C:/tmp/S_Hospital_release_12062039
- Rama/HEAD: (detached) / 120620390b1bad9a49cbf07a5ecc4ee3709dd82f
- Archivos cambiados: 48; untracked: 0.
- Posibles secretos/artefactos por ruta: 5; patrones sensibles en contenido: 14.
- Estado de preservacion: PRESERVACION MANUAL REQUERIDA. Parches rastreados guardados localmente en carpeta forense; worktree intacto.
- Rama archive creada: no creada. Push: no realizado.
- Accion pendiente: revision humana antes de cualquier commit o push de esos cambios.

### S_Hospital_verify_b2fe0b43

- Ruta: C:/tmp/S_Hospital_verify_b2fe0b43
- Rama/HEAD: (detached) / b2fe0b430be9aa94a955d4bb6dee57a3c8dcc62b
- Archivos cambiados: 418; untracked: 0.
- Posibles secretos/artefactos por ruta: 43; patrones sensibles en contenido: 112.
- Estado de preservacion: PRESERVACION MANUAL REQUERIDA. Parches rastreados guardados localmente en carpeta forense; worktree intacto.
- Rama archive creada: no creada. Push: no realizado.
- Accion pendiente: revision humana antes de cualquier commit o push de esos cambios.


## Ramas de rescate

- Total rescue locales no integradas: 78.
- Clasificacion aplicada: RESCATE_CONSERVAR.
- No se borro ninguna rama rescue.
- Los grupos se basaron en mismo SHA, mismo tree hash y mismo conjunto de archivos modificados.

Grupos representativos:

- same_sha e5db50b1c5ca: 2 refs, muestra rescue/no-perder-nada-20260615-171019/stash/10.
- same_sha 6ca25f2de318: 2 refs, muestra rescue/no-perder-nada-20260615-171019/stash/27.
- same_sha 3ab1d5b41490: 2 refs, muestra rescue/no-perder-nada-20260615-171019/stash/7.
- same_sha d53627a887f3: 2 refs, muestra rescue/no-perder-nada-20260615-171019/stash/11.
- same_sha dbc961ded8ec: 2 refs, muestra rescue/no-perder-nada-20260615-171019/stash/26.
- same_sha 3b7ba59588e9: 2 refs, muestra rescue/no-perder-nada-20260615-171019/stash/9.
- same_sha a4da086e67ce: 2 refs, muestra rescue/no-perder-nada-20260615-171019/stash/28.
- same_sha c6ae34f34104: 2 refs, muestra rescue/no-perder-nada-20260615-171019/stash/24.
- same_sha 48ce8b42c180: 2 refs, muestra rescue/no-perder-nada-20260615-171019/stash/31.
- same_sha 74dfa24b5777: 2 refs, muestra rescue/no-perder-nada-20260615-171019/stash/12.
- same_sha 74fb4928b0ab: 2 refs, muestra rescue/no-perder-nada-20260615-171019/stash/29.
- same_sha ba43481f79a0: 2 refs, muestra rescue/no-perder-nada-20260615-171019/stash/30.
- same_sha 186623e4b385: 2 refs, muestra rescue/no-perder-nada-20260615-171019/stash/3.
- same_sha bd0562353390: 2 refs, muestra rescue/no-perder-nada-20260615-171019/stash/5.
- same_sha db3a3280aac4: 2 refs, muestra rescue/no-perder-nada-20260615-171019/stash/19.
- same_sha 17f9fb5761f1: 2 refs, muestra rescue/no-perder-nada-20260615-171019/stash/0.
- same_sha 26190426a5da: 2 refs, muestra rescue/no-perder-nada-20260615-171019/stash/32.
- same_sha 1010a345a249: 2 refs, muestra rescue/no-perder-nada-20260615-171019/stash/17.
- same_sha c433cd1b33d3: 2 refs, muestra rescue/no-perder-nada-20260615-171019/stash/23.
- same_sha 00a0b6254025: 2 refs, muestra rescue/no-perder-nada-20260615-171019/stash/16.
- same_sha b0791cba6e0e: 2 refs, muestra rescue/no-perder-nada-20260615-171019/stash/2.
- same_sha 62308c6fa2a2: 2 refs, muestra rescue/no-perder-nada-20260615-171019/stash/1.
- same_sha 3174b52fdc74: 2 refs, muestra rescue/no-perder-nada-20260615-171019/stash/20.
- same_sha 95e0f529ba4b: 2 refs, muestra rescue/no-perder-nada-20260615-171019/stash/21.
- same_sha 5ce6590fd9c6: 2 refs, muestra rescue/no-perder-nada-20260615-171019/stash/34.
- same_sha 1956dc0f8e00: 2 refs, muestra rescue/no-perder-nada-20260615-171019/stash/15.
- same_sha 1efa365b43ce: 2 refs, muestra rescue/no-perder-nada-20260615-171019/stash/25.
- same_sha 56540af75c15: 2 refs, muestra rescue/no-perder-nada-20260615-171019/stash/8.
- same_sha 67ec8c3c7e1a: 2 refs, muestra rescue/no-perder-nada-20260615-171019/stash/6.
- same_sha 633db4f87cb3: 2 refs, muestra rescue/no-perder-nada-20260615-171019/stash/33.

## Ramas audit

- audit/f6-post-approval-sensitive-a979d5b7: 1 commit, P0, duplica codex/f6-operational-polish por SHA. Contiene ajustes de voiding, CSP report, fiscal requests, pruebas y una migracion antigua de idempotencia legacy. Main ya tiene comando/pruebas de idempotencia legacy en ruta final; quedan solo pruebas/migracion antiguas como referencia.
- audit/f6-post-approval-sensitive-c851057f: 1 commit, P0, duplica merge/f6-approved-a9377e9f por SHA. Es una version alternativa/antigua del cifrado de idempotency keys; main contiene implementacion final por comando Artisan.

No se deben fusionar documentaciones antiguas que contradigan el cierre final de software.

## Candidatos de recuperacion

- Ramas codex/recovery-eval-* creadas: ninguna.
- Candidatos RECUPERABLE_Y_VALIDADO: 0.
- Candidatos RECUPERABLE_CON_ADAPTACION: 0.
- REQUIERE_DECISION_NEGOCIO: docs offline faltantes y metadatos extendidos de backup.
- OBSOLETO/superado: codex/final-rc-scope-cutover, codex/production-readiness-preflight como rama completa, codex/supply-chain-hardening como rama completa por artefactos generados y base antigua.

## Conclusion

NO ES POSIBLE DETERMINARLO SIN DECISION DEL USUARIO

La evidencia no muestra una rama completa que deba fusionarse. Si se reabre el proyecto, las unicas decisiones razonables son puntuales: reimplementar sobre main docs offline faltantes, una prueba moderna para restriccion de borrado de invoice_items, una prueba no fragil de orden de locks, o metadatos de backup si operaciones lo exige. No se borro nada, no se fusiono nada y main no fue modificado.
