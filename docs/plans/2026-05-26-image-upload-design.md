# Image Upload Design

**Date:** 2026-05-26

**Goal:** Allow the sidebar composer to attach images for models whose `input` capability includes `"image"`, with file picking, paste support, preview, and remove-before-send.

## Constraints

- The existing RPC prompt contract already accepts `images: [{ path }]`.
- The webview cannot reliably obtain an absolute local path from pasted image data.
- Command names remain English-only; this work only changes composer behavior.

## Chosen Approach

Use host-managed attachments while preserving the existing RPC contract:

- The webview owns pending attachment UI state.
- The provider owns VS Code APIs for file picking and writing pasted images to a temp directory.
- The controller remains unchanged apart from forwarding `images` with the prompt.

## Data Flow

### Pick image

1. Webview posts `pick_image_attachments`.
2. Provider opens `showOpenDialog` for image files.
3. Provider reads each selected file, converts it to a preview data URL, and posts the attachment payload back to the webview.
4. Webview renders previews and stores `{ id, path, previewUrl, name }`.

### Paste image

1. Webview reads clipboard image data on `paste`.
2. Webview posts `store_pasted_image_attachment` with base64 payload and mime type.
3. Provider writes the file into extension storage and returns `{ path, previewUrl, name }`.
4. Webview appends the attachment to pending state and renders the preview.

### Send prompt

1. Webview sends `send_prompt` with `images: [{ path }]`.
2. Controller forwards the existing RPC `prompt` command with the same `images` payload.
3. Webview clears pending attachments after sending.

## Model Capability

- Extend the available model parser to read the optional `input` array.
- Image attachment UI is available only when the active model declares `"image"` support.
- Pasting an image while the active model does not support image input surfaces a visible error message.

## Error Handling

- Invalid image payloads are rejected during protocol parsing.
- File picker cancellation is silent.
- File read/write failures surface as UI errors through the existing error channel.
- Unsupported image paste surfaces a visible composer error instead of silently dropping the image.

## Testing

- Protocol parsing for new webview/provider attachment messages.
- Provider tests for file picking and pasted-image persistence.
- Webview tests for capability gating, preview rendering, remove-before-send, paste handling, and prompt payload.
- Controller regression test that attached image paths are forwarded with `send_prompt`.
