import * as vscode from "vscode";

const PYTHON_EXTENSION_ID = "ms-python.python";

interface Settings {
  onDidChangeExecutionDetails: vscode.Event<vscode.Uri | undefined>;
  getExecutionDetails: () => { execCommand: string[] | undefined };
}

export interface VscodePython {
  ready: Thenable<void>;
  settings: Settings;
}

async function getExtensionAPI<T>(extensionId: string): Promise<T | undefined> {
  const extension = vscode.extensions.getExtension(extensionId);
  if (!extension) {
    return;
  }

  try {
    return await extension.activate();
  } catch (error) {
    console.log("Error loading VSCode extension", error);
  }
}

async function getPythonExtensionSettings(): Promise<Settings | undefined> {
  const api = await getExtensionAPI<VscodePython>(PYTHON_EXTENSION_ID);
  if (!api) {
    return;
  }
  try {
    await api.ready;
  } catch {}
  return api.settings;
}

export async function getPythonExecutionDetails(): Promise<string[] | undefined> {
  const settings = await getPythonExtensionSettings();
  return settings?.getExecutionDetails().execCommand;
}

export async function getPythonExecutionPath(): Promise<string | undefined> {
  const executionDetails = await getPythonExecutionDetails();
  const executionPath = executionDetails?.join(" ");
  if (executionPath) {
    return executionPath;
  }
}

export async function getOnDidChangePythonExecutionDetails() {
  const settings = await getPythonExtensionSettings();
  return settings?.onDidChangeExecutionDetails;
}
