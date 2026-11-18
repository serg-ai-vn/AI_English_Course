# Accepted UI baseline — 2026-11-18

The owner approved independent acceptance, merging TASK-06–09 into main while
retaining commit history, a recovery checkpoint, verified runtime backups and
a separate branch for the subsequent lesson redesign. Other design wishes are
deferred. This is source consolidation, not VPS/live-class deployment approval.

## Independent acceptance

Implementation: `74f6585900cbfc179a1bca09e33ad3f844338dd5`, compared with
`4a24548fdf6abd9e71226be21a2def4b44093433`.
Separate reviewing agent: `independent_acceptance`, explicitly authorized by
the owner. Result: **PASS, no merge-blocking findings**. Review is recorded in
this chat; no GitHub APPROVED review is claimed.

Reviewer inspected TASK-06–09, substantive app/workspace helpers, bootstrap/CSS,
validator browser adapter, exact public routes, lesson display metadata and
browser scenarios. Verified boundaries: Classroom Light default, Night Lab
retained, independent disclosures, visible active task/result, shared validator,
original hobby IDs/save/correction contracts and isolated drafts. Server stages,
provider, progress schema, export and L4 preset values remain unchanged.

Reviewer inspected three saved screenshots and independently ran two pure Node
tests (browser-validator/glossary): 2/2 PASS. PR head and checks #33 verified.
Reviewer did not claim a new full browser run, paid API testing, physical-device
or projector testing, pedagogical effectiveness or VPS acceptance.

Any documentation follow-up must have its exact diff reviewed and final SHA
confirmed. Final reviewed head, continuation acceptance and merge result belong
in [PR #3](https://github.com/serg-ai-vn/AI_English_Course/pull/3).

## Root verification

Repeated on 2026-11-18: syntax/JSON/contracts, Node 15/15, isolated HTTP smoke
(10 public routes and 5 denied private paths), build. Export SHA-256 unchanged:
`19982ef50c7f3a246c3cbd0a8c67d933b4e2ead5f01b996292101000a33125d5`.
Prior full two-theme browser run: 14/14; final presentation rerun: 2/2.
[Checks #33](https://github.com/serg-ai-vn/AI_English_Course/actions/runs/43388870438)
passed at the implementation SHA; final head CI is checked separately in PR #3.
The acceptance documentation changes no runtime/curriculum implementation.

Earlier reports retain their historical PENDING/IN_REVIEW records; this report
and the current backlog supersede them. Classroom Light is the primary platform
design. Night Lab is an alternative palette, not a workflow rollback or L4 preset.

## Runtime recovery

Snapshots outside Git: `../Backups/2026-11-18-ui-baseline/main-data` (8 files)
and `preview-data` (12 files). Sources: Main/platform/data and the persistent
sibling LocalPreviewData. Only our previously launched preview on 3001 was
briefly stopped; no server on 3000 was found. The same preview DATA_DIR resumed.

The existing backup CLI excludes sessions and temporary files. Each snapshot
was restored into a NEW empty verification directory. Every manifest SHA-256
matched snapshot, restored copy and unchanged source; JSON parsed successfully.
No restore/reset touched live progress. Accounts/PINs, keys, sessions, backups,
logs and restored copies remain outside Git. Local manifests and VERIFIED.txt
retain the verification evidence.

## Next work

Create the recovery tag on the actual merged baseline, synchronize local and
GitHub main, then create/push a new branch from that same commit. Intended next
allocation: L3 avatar + hobby images; L4 background + website theme. No fields
or gates are moved by this report. The next task must coordinate Lesson Spec,
DECISIONS, configs, validators, server, both UIs, unlock rules, export, tests and
existing progress. Do not start reconstruction from the old main.

Recover code through explicit commits/revert work, without force-pushing main.
Never restore old runtime data over newer student work merely to change code
or colors. Runtime backup and code history solve separate recovery problems.
