import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { rolldown } from 'rolldown';

const root = path.resolve(new URL('..', import.meta.url).pathname);

async function loadTypeScript(relativePath) {
  const filename = path.join(root, relativePath);
  const bundle = await rolldown({ input: filename });
  const output = await bundle.generate({ format: 'cjs' });
  const code = output.output.find((entry) => entry.type === 'chunk')?.code;
  await bundle.close();
  if (!code) throw new Error(`No compiled output for ${relativePath}`);
  const module = { exports: {} };
  new Function('module', 'exports', code)(module, module.exports);
  return module.exports;
}

const appearance = await loadTypeScript('src/lib/appearance-domain.ts');
const clipboard = await loadTypeScript('src/lib/clipboard-domain.ts');
const contracts = await loadTypeScript('src/lib/contracts.ts');
const ai = await loadTypeScript('src/lib/ai-domain.ts');
const presentation = await loadTypeScript('src/lib/presentation-domain.ts');
const migrationFlags = await loadTypeScript('src/lib/migration-flags.ts');

test('appearance normalization preserves zero values and legacy defaults', () => {
  assert.deepEqual(appearance.normalizeAppearance({ blurAmount: 0, transparency: 0 }), {
    theme: 'dark', acrylic: true, blurAmount: 0, transparency: 0,
  });
  assert.deepEqual(appearance.normalizeAppearance({ theme: 'light', acrylic: false, blurAmount: 45, transparency: -5 }), {
    theme: 'light', acrylic: false, blurAmount: 40, transparency: 0,
  });
  assert.deepEqual(appearance.normalizeAppearance({ blurAmount: '0', transparency: null }), appearance.DEFAULT_APPEARANCE);
});

test('clipboard settings accept only the existing history limits', () => {
  assert.deepEqual(clipboard.normalizeClipboardSettings({ autoCapture: false, maxItems: 200 }), {
    autoCapture: false, maxItems: 200,
  });
  assert.deepEqual(clipboard.normalizeClipboardSettings({ maxItems: 75 }), clipboard.DEFAULT_CLIPBOARD_SETTINGS);
  assert.deepEqual(clipboard.normalizeClipboardSettings({ maxItems: '25' }), {
    autoCapture: true, maxItems: 25,
  });
});

test('clipboard history normalization filters invalid entries and preserves image data', () => {
  let id = 0;
  const nextId = () => `generated-${++id}`;
  const longText = 'x'.repeat(clipboard.MAX_TEXT_LENGTH + 10);
  const history = clipboard.normalizeClipboardHistory([
    null,
    { text: 'valid', createdAt: 10 },
    { id: 'image', text: 'data:image/png;base64,abc', pinned: 1, createdAt: 20 },
    { id: 'long', text: longText, createdAt: 30 },
    { text: 42 },
  ], nextId, 99);

  assert.equal(history.length, 3);
  assert.equal(history[0].id, 'generated-1');
  assert.equal(history[1].pinned, true);
  assert.equal(history[1].text, 'data:image/png;base64,abc');
  assert.equal(history[2].text.length, clipboard.MAX_TEXT_LENGTH);
});

test('clipboard trimming keeps pins and evicts the oldest unpinned entries', () => {
  const items = [
    { id: 'old', text: 'old', createdAt: 1 },
    { id: 'new', text: 'new', createdAt: 3 },
    { id: 'pinned', text: 'pinned', createdAt: 0, pinned: true },
  ];
  const trimmed = clipboard.trimClipboardHistory(items, 2);
  assert.deepEqual(trimmed.map((item) => item.id), ['pinned', 'new']);
  assert.deepEqual(items.map((item) => item.id), ['old', 'new', 'pinned']);
});

test('clipboard add updates duplicate timestamps without creating a second item', () => {
  const existing = [{ id: 'same', text: 'same', createdAt: 1, pinned: true }];
  const updated = clipboard.addClipboardItem(existing, 'same', () => 'unused', 10, 50);
  assert.equal(updated.length, 1);
  assert.equal(updated[0].id, 'same');
  assert.equal(updated[0].createdAt, 10);
  assert.equal(existing[0].createdAt, 1);
});

test('AI settings normalization preserves provider defaults and legacy migrations', () => {
  const settings = ai.normalizeAiSettings({
    imageModel: 'not-a-real-image-model',
    providerKeys: { openai: 'secret' },
    providerConfig: { lmstudio: { modelId: 'qwen' } },
    customEndpoints: [
      { id: 42, name: 'Local', baseURL: 'http://127.0.0.1/v1', contextLimit: 0 },
      { name: 'missing id' },
    ],
  });
  assert.equal(settings.imageModel, 'gpt-image-2');
  assert.equal(settings.providerKeys.openai, 'secret');
  assert.deepEqual(settings.providerConfig.lmstudio, {
    baseUrl: 'http://localhost:1234/v1', modelId: 'qwen',
  });
  assert.equal(settings.customEndpoints.length, 1);
  assert.deepEqual(settings.customEndpoints[0], {
    id: '42', name: 'Local', baseUrl: 'http://127.0.0.1/v1', modelId: '', imageModelId: '', contextLimit: 128000,
  });
});

test('AI provider key rules and masking match the legacy settings UI', () => {
  assert.equal(ai.providerNeedsKey('openai'), true);
  assert.equal(ai.providerNeedsKey('ollama'), false);
  assert.equal(ai.providerNeedsKey('openai-compatible'), false);
  assert.equal(ai.providerNeedsKey('custom:42'), false);
  assert.equal(ai.maskApiKey('short'), '•••••');
  assert.equal(ai.maskApiKey('abcdefghijklmnop'), 'abcd••••••••mnop');
});

test('presentation helpers preserve image, history, length, and translation behavior', () => {
  assert.equal(presentation.generatedImageDataUrl('data:image/jpeg;base64,abc'), 'data:image/jpeg;base64,abc');
  assert.equal(presentation.generatedImageDataUrl('/9j/abc'), 'data:image/jpeg;base64,/9j/abc');
  assert.equal(presentation.generatedImageDataUrl('UklGRabc'), 'data:image/webp;base64,UklGRabc');
  assert.equal(presentation.generatedImageDataUrl('abc'), 'data:image/png;base64,abc');
  assert.equal(presentation.generatedImageDataUrl(''), '');

  const now = new Date(2026, 8, 6, 16, 0, 0).getTime();
  assert.equal(presentation.formatTime(new Date(2026, 8, 6, 9, 5, 0).getTime(), now, 'en-US'), '9:05 AM');
  assert.equal(presentation.historyGroupLabel(new Date(2026, 8, 6, 1).getTime(), now, 'en-US'), 'Today');
  assert.equal(presentation.historyGroupLabel(new Date(2026, 8, 5, 1).getTime(), now, 'en-US'), 'Yesterday');
  assert.equal(presentation.formatLength('x'), '1 character');
  assert.equal(presentation.formatLength('xy'), '2 characters');
  assert.equal(presentation.formatShortcutKey(' '), 'Space');
  assert.equal(presentation.formatShortcutKey('a'), 'A');
  assert.equal(presentation.translate('hello', 'fr', { en: { hello: 'Hello' }, fr: {} }), 'Hello');
  assert.equal(presentation.translate('missing', 'fr', { en: {} }), 'missing');
});

test('typed registries preserve the native command and event names', () => {
  assert.deepEqual(Object.values(contracts.TAURI_COMMANDS), [
    'process_text', 'generate_image', 'copy_image_to_clipboard',
    'write_to_clipboard', 'read_clipboard_text', 'start_clipboard_monitor',
    'clipboard_command', 'paste_text', 'configure_shortcuts', 'encrypt_data',
    'decrypt_data', 'lm_ping', 'open_notepad_window', 'close_notepad_window',
    'open_clipboard_window', 'open_clipboard_only_window', 'close_clipboard_window',
  ]);
  assert.deepEqual(Object.values(contracts.TAURI_EVENTS), [
    'selection-captured', 'clipboard-captured', 'clipboard-command', 'appearance-changed',
  ]);
  assert.deepEqual(Object.values(contracts.STORAGE_KEYS), [
    'ghost_writer_appearance_v1', 'app_shortcut', 'clipboard_shortcut',
    'ghost_writer_clipboard_history_v1', 'ghost_writer_clipboard_settings_v1',
    'ghost_writer_notepad_v2', 'luminus_notepad_v2', 'luminus_notepad_notes',
    'ghost_writer_notepad_notes', 'ghost_writer_ai_settings_enc',
    'luminus_ai_settings_enc', 'luminus_openai_api_key_enc',
  ]);
});

test('React migration flags default to the legacy owner and can be toggled explicitly', () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  assert.equal(migrationFlags.isReactHomeEnabled(storage), false);
  assert.equal(migrationFlags.isReactHomeModelsEnabled(storage), false);
  assert.equal(migrationFlags.isReactHomeGeneralEnabled(storage), false);
  assert.equal(migrationFlags.isReactNotepadEnabled(storage), false);
  assert.equal(migrationFlags.isReactClipboardEnabled(storage), false);
  migrationFlags.setReactNotepadEnabled(true, storage);
  assert.equal(migrationFlags.isReactNotepadEnabled(storage), true);
  values.set(migrationFlags.REACT_NOTEPAD_FLAG, 'false');
  assert.equal(migrationFlags.isReactNotepadEnabled(storage), false);
});
