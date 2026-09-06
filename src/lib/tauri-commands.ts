import { invoke } from "./tauri";
import { TAURI_COMMANDS, type ClipboardCommandArgs, type ClipboardImageArgs, type ConfigureShortcutsArgs, type DecryptDataArgs, type EncryptDataArgs, type GenerateImageArgs, type LmPingArgs, type ProcessTextRequest, type TextArgs } from "./contracts";

export function processText(request: ProcessTextRequest) {
  return invoke<string>(TAURI_COMMANDS.processText, { request });
}

export function generateImage(args: GenerateImageArgs) {
  return invoke<string>(TAURI_COMMANDS.generateImage, args);
}

export function copyImageToClipboard(args: ClipboardImageArgs) {
  return invoke<void>(TAURI_COMMANDS.copyImageToClipboard, args);
}

export function writeToClipboard(args: TextArgs) {
  return invoke<void>(TAURI_COMMANDS.writeToClipboard, args);
}

export function readClipboardText() {
  return invoke<string>(TAURI_COMMANDS.readClipboardText);
}

export function startClipboardMonitor() {
  return invoke<void>(TAURI_COMMANDS.startClipboardMonitor);
}

export function sendClipboardCommand(args: ClipboardCommandArgs) {
  return invoke<void>(TAURI_COMMANDS.clipboardCommand, args);
}

export function pasteText(args: TextArgs) {
  return invoke<void>(TAURI_COMMANDS.pasteText, args);
}

export function configureShortcuts(args: ConfigureShortcutsArgs) {
  return invoke<void>(TAURI_COMMANDS.configureShortcuts, args);
}

export function encryptData(args: EncryptDataArgs) {
  return invoke<string>(TAURI_COMMANDS.encryptData, args);
}

export function decryptData(args: DecryptDataArgs) {
  return invoke<string>(TAURI_COMMANDS.decryptData, args);
}

export function lmPing(args: LmPingArgs) {
  return invoke<number>(TAURI_COMMANDS.lmPing, args);
}

export function openNotepadWindow() {
  return invoke<void>(TAURI_COMMANDS.openNotepadWindow);
}

export function closeNotepadWindow() {
  return invoke<void>(TAURI_COMMANDS.closeNotepadWindow);
}

export function openClipboardWindow() {
  return invoke<void>(TAURI_COMMANDS.openClipboardWindow);
}

export function openClipboardOnlyWindow() {
  return invoke<void>(TAURI_COMMANDS.openClipboardOnlyWindow);
}

export function closeClipboardWindow() {
  return invoke<void>(TAURI_COMMANDS.closeClipboardWindow);
}
