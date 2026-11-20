# Verification run-20261120-073016

Commit: 3c7012f1e3a9cc49461201080a0322edf4b1cc62. Worktree: clean at launch (the journey was edited afterwards; product code unchanged). Level: journeys.

## Flows

| Flow | Result | Screenshots |
|---|---|---|
| edit-delete-messages-chamados | proved (10 steps). A first run failed: the refused delete returns 502 by design and the kit counts any 5xx as a failure; that step was removed from the journey (refusal stays in the Playwright tests) | edit-delete-messages-chamados/ |
| edit-delete-sent-message | proved (9 steps, not published here) | - |
| message-revisions | proved (7 steps, not published here) | - |
| reply | proved (14 steps, not published here) | - |

## Comparison with the design

Same as prototype 293: ⋯ menu on the bubble, "Editando" strip with the message and Cancelar, draft recovered, delete dialog with both options, "Editada"/"Excluída" labels, notice "Mensagem excluída no XET". Differences: Responder stays a separate button (the prototype puts it in the menu); the reason for an unavailable action is inside the menu, not under the message.

## Not proved

- Real WhatsApp (Whatsmeow edit/revoke/caption): manual.
- Refusal and uncertain result on screen, 15-minute and 2-day deadlines, sending/failed messages, themes, keyboard and focus, duplicate confirmation: covered by `frontend/e2e/message-edit-delete.spec.ts`, not by this journey.

## Errors in the log

3 WARN lines in the backend log, all provoked on purpose: two "provider did not accept the message" (refused edit/delete by the fake adapter) and one "sector not connected" (the `reply` journey drops the number).
