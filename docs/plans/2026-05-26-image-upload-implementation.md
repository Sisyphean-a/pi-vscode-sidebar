# Image Upload Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add image attachments to the sidebar composer for models that support image input.

**Architecture:** Keep the existing RPC `images: [{ path }]` contract. Let the webview manage pending attachment UI, and let the provider handle file picking plus pasted-image persistence with VS Code APIs and extension storage.

**Tech Stack:** TypeScript, VS Code webview/provider APIs, Vitest, jsdom

---

### Task 1: Persist the approved design

**Files:**
- Create: `docs/plans/2026-05-26-image-upload-design.md`
- Create: `docs/plans/2026-05-26-image-upload-implementation.md`

**Step 1: Verify the design files exist**

Run: `Get-ChildItem docs/plans`

Expected: Both image-upload planning documents are listed.

### Task 2: Add attachment protocol tests first

**Files:**
- Modify: `test/unit/view/protocol.test.ts`

**Step 1: Write the failing tests**

- Add coverage for `pick_image_attachments`.
- Add coverage for `store_pasted_image_attachment`.

**Step 2: Run the focused test**

Run: `npm test -- test/unit/view/protocol.test.ts`

Expected: FAIL because the new message types are not parsed yet.

**Step 3: Implement the minimal protocol parsing**

- Extend `src/view/protocol.ts` with the new UI-to-host messages and host-to-UI attachment payload.

**Step 4: Re-run the focused test**

Run: `npm test -- test/unit/view/protocol.test.ts`

Expected: PASS

### Task 3: Add provider tests for file picking and pasted-image storage

**Files:**
- Modify: `test/unit/view/provider.test.ts`
- Modify: `src/view/provider.ts`
- Modify: `src/extension.ts`

**Step 1: Write failing provider tests**

- File picker returns attachment payloads back to the webview.
- Pasted image bytes are written to storage and returned as an attachment payload.

**Step 2: Run the focused provider test**

Run: `npm test -- test/unit/view/provider.test.ts`

Expected: FAIL because the provider has no attachment handlers yet.

**Step 3: Implement the minimal provider support**

- Add storage URI plumbing from `extension.ts`.
- Handle the new attachment messages in `provider.ts`.

**Step 4: Re-run the provider test**

Run: `npm test -- test/unit/view/provider.test.ts`

Expected: PASS

### Task 4: Add webview tests for attachment UI and payload forwarding

**Files:**
- Modify: `test/unit/view/app.test.ts`
- Modify: `test/unit/view/app-model-state.test.ts`
- Modify: `src/view/webview/template.ts`
- Modify: `src/view/webview/styles.css`
- Modify: `src/view/webview/app.ts`

**Step 1: Write failing tests**

- Model capability enables image UI only for models with `"image"` input support.
- Attachment previews render and can be removed.
- Sending a prompt includes `images`.
- Pasting while unsupported shows a visible error.

**Step 2: Run the focused webview tests**

Run: `npm test -- test/unit/view/app.test.ts test/unit/view/app-model-state.test.ts`

Expected: FAIL because the composer has no image attachment UI yet.

**Step 3: Implement the minimal webview changes**

- Parse model input capability.
- Add attachment button, preview list, paste handling, and removal.
- Include `images` in `send_prompt`.

**Step 4: Re-run the focused webview tests**

Run: `npm test -- test/unit/view/app.test.ts test/unit/view/app-model-state.test.ts`

Expected: PASS

### Task 5: Add controller regression coverage for attached prompts

**Files:**
- Modify: `test/unit/host/controller.test.ts`

**Step 1: Write the failing test**

- `send_prompt` with `images` reaches the RPC prompt command unchanged.

**Step 2: Run the focused controller test**

Run: `npm test -- test/unit/host/controller.test.ts`

Expected: FAIL if the prompt images are dropped.

**Step 3: Adjust implementation only if needed**

- Keep the controller forwarding `images` verbatim.

**Step 4: Re-run the focused controller test**

Run: `npm test -- test/unit/host/controller.test.ts`

Expected: PASS

### Task 6: Final verification

**Files:**
- Verify all touched files

**Step 1: Run targeted verification**

Run: `npm test -- test/unit/view/protocol.test.ts test/unit/view/provider.test.ts test/unit/view/app.test.ts test/unit/view/app-model-state.test.ts test/unit/host/controller.test.ts`

Expected: PASS

**Step 2: Run type checking**

Run: `npm run typecheck`

Expected: PASS
