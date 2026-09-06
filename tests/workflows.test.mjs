import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';

// Exercise the shipped inline handlers with an isolated store and IPC bridge.
const main = fs.readFileSync(new URL('../src/index.html', import.meta.url), 'utf8');
const clipboard = fs.readFileSync(new URL('../src/clipboard.html', import.meta.url), 'utf8');
function handler(source, name) {
  const match = source.match(new RegExp(`^      (?:async )?function ${name}\\([\\s\\S]*?^      }`, 'm'));
  assert.ok(match, `Missing handler ${name}`);
  return match[0];
}
function setup(names, source = main) {
  const elements = new Map();
  const storage = new Map();
  const calls = [];
  const sandbox = {
    crypto: webcrypto, Date, console,
    clipboardSettings: { maxItems: 2, autoCapture: true },
    CLIPBOARD_HISTORY_STORAGE_KEY: 'history',
    capturedText: 'This are a test.', aiResult: 'This is a test.',
    manualSelection: false, selectionVersion: 0, currentAction: 'standard',
    currentImageMode: 'diagram', currentGeneratedBase64: 'data:image/png;base64,dGVzdA==',
    DIAGRAM_SYSTEM_PROMPT: 'Draw a diagram of the source.',
    loadAiSettings: async () => {},
    getSelectedAiRequest: () => ({ provider: 'openai', model: 'test', api_key: 'fake-test-key' }),
    getSelectedImageRequest: () => ({ provider: 'openai', model: 'test', api_key: 'fake-test-key' }),
    providerNeedsKey: () => true,
    updateClipboardSettingsUI() {}, showToast() {}, showView() {},
    extractErrorMessage: String, t: value => value,
    getGeneratedImageDataUrl: () => 'data:image/png;base64,dGVzdA==',
    generatedImageAsPngBase64: async () => 'dGVzdA==',
    getCurrentWindow: () => ({ hide: async () => {} }),
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    document: { getElementById: id => {
      if (!elements.has(id)) {
        const classes = new Set();
        elements.set(id, { style: {}, value: '', classList: {
          add: c => classes.add(c), remove: c => classes.delete(c),
          toggle: (c, yes) => yes ? classes.add(c) : classes.delete(c), contains: c => classes.has(c),
        }});
      }
      return elements.get(id);
    }},
    invoke: async (command, args) => { calls.push({ command, args }); return command === 'process_text' ? 'This is a test.' : 'data:image/png;base64,dGVzdA=='; },
  };
  vm.createContext(sandbox);
  vm.runInContext(names.map(name => handler(source, name)).join('\n'), sandbox);
  return { sandbox, calls, storage, elements };
}
const historyHandlers = ['getClipboardHistory', 'trimClipboardHistory', 'saveClipboardHistory', 'addClipboardHistoryItem', 'sendClipboardCommand'];

test('history evicts oldest unpinned entry and preserves pins', () => {
  const { sandbox: s } = setup(['trimClipboardHistory']);
  const items = [{id:'old',createdAt:1}, {id:'new',createdAt:3}, {id:'pinned',createdAt:0,pinned:true}];
  s.trimClipboardHistory(items);
  assert.deepEqual(items.map(i => i.id), ['pinned', 'new']);
});
test('clipboard view uses the same retention rule', () => {
  const { sandbox: s } = setup(['sortItems', 'trimItems'], clipboard);
  s.items = [{id:'old',createdAt:1}, {id:'new',createdAt:3}, {id:'pinned',createdAt:0,pinned:true}];
  s.trimItems();
  assert.deepEqual(s.items.map(i => i.id), ['pinned', 'new']);
});
test('copying repeated text deduplicates history', () => {
  const { sandbox:s, storage } = setup(historyHandlers);
  s.addClipboardHistoryItem('same'); s.addClipboardHistoryItem('same');
  assert.equal(JSON.parse(storage.get('history')).length, 1);
});
test('rewrite waits for Accept before replacing source', async () => {
  const { sandbox:s, calls } = setup(['handleAI', 'acceptResult']);
  await s.handleAI('Fix grammar');
  assert.deepEqual(calls.map(c=>c.command), ['process_text']);
  await s.acceptResult();
  assert.equal(calls[1].command, 'paste_text');
  assert.equal(calls[1].args.text, 'This is a test.');
});
test('summary offers copy without replacing source', async () => {
  const { sandbox:s, calls, elements } = setup([...historyHandlers, 'handleAI', 'copySummary']);
  await s.handleAI('Summarize this text');
  assert.ok(elements.get('standard-result-actions').classList.contains('hidden'));
  await s.copySummary();
  assert.ok(calls.some(c=>c.command === 'write_to_clipboard'));
  assert.ok(!calls.some(c=>c.command === 'paste_text'));
});
test('manually loaded text cannot replace a stale source selection', async () => {
  const { sandbox:s, calls } = setup(['acceptResult']);
  s.manualSelection = true;
  await s.acceptResult();
  assert.equal(calls.length, 0);
});
test('stale responses do not replace the result for a new selection', async () => {
  const { sandbox:s } = setup(['handleAI']);
  s.invoke = async () => { s.selectionVersion++; return 'stale'; };
  await s.handleAI('Fix grammar');
  assert.equal(s.aiResult, '');
});
test('image and diagram generation require source text and never paste', async () => {
  const { sandbox:s, calls } = setup(['handleGenerateImage']);
  s.capturedText = '';
  await s.handleGenerateImage('diagram');
  assert.equal(calls.length, 0);
  s.capturedText = 'First draft, then review, then publish.';
  await s.handleGenerateImage('diagram');
  assert.equal(calls[0].command, 'generate_image');
  assert.ok(calls[0].args.prompt.includes(s.capturedText));
  assert.equal(calls.length, 1);
});
test('image copy writes an image and keeps history, without pasting', async () => {
  const { sandbox:s, calls, storage } = setup([...historyHandlers, 'copyImageResult']);
  await s.copyImageResult();
  assert.equal(calls[0].command, 'copy_image_to_clipboard');
  assert.ok(JSON.parse(storage.get('history'))[0].text.startsWith('data:image/png;'));
  assert.ok(!calls.some(c=>c.command.includes('paste')));
});
test('text and diagram notes preserve existing notes and image attachments', async () => {
  const { sandbox:s, storage } = setup(['saveResultToNotepad']);
  storage.set('ghost_writer_notepad_v2', JSON.stringify([{id:'existing',content:'Keep me'}]));
  await s.saveResultToNotepad(false);
  await s.saveResultToNotepad(true);
  const notes = JSON.parse(storage.get('ghost_writer_notepad_v2'));
  assert.equal(notes.length, 3);
  assert.equal(notes[0].title, 'Generated diagram');
  assert.ok(notes[0].image.startsWith('data:image/'));
  assert.equal(notes[1].content, 'This is a test.');
  assert.equal(notes[2].content, 'Keep me');
});
