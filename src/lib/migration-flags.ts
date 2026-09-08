export const REACT_SHELL_FLAG = "ghost_writer_react_shell_v1";
export const REACT_HOME_FLAG = "ghost_writer_react_home_v1";
export const REACT_HOME_MODELS_FLAG = "ghost_writer_react_home_models_v1";
export const REACT_NOTEPAD_FLAG = "ghost_writer_react_notepad_v1";
export const REACT_CLIPBOARD_FLAG = "ghost_writer_react_clipboard_v1";

function readFlag(key: string, storage?: Storage) {
  try {
    return (storage ?? localStorage).getItem(key) === "true";
  } catch {
    return false;
  }
}

export function isReactShellEnabled(storage?: Storage) {
  return readFlag(REACT_SHELL_FLAG, storage);
}

export function isReactHomeEnabled(storage?: Storage) {
  return readFlag(REACT_HOME_FLAG, storage);
}

export function isReactHomeModelsEnabled(storage?: Storage) {
  return readFlag(REACT_HOME_MODELS_FLAG, storage);
}

export function isReactNotepadEnabled(storage?: Storage) {
  return readFlag(REACT_NOTEPAD_FLAG, storage);
}

export function isReactClipboardEnabled(storage?: Storage) {
  return readFlag(REACT_CLIPBOARD_FLAG, storage);
}

export function setReactNotepadEnabled(enabled: boolean, storage?: Storage) {
  (storage ?? localStorage).setItem(REACT_NOTEPAD_FLAG, String(enabled));
}
