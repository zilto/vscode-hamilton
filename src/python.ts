import * as vscode from 'vscode';


interface Settings {
  onDidChangeExecutionDetails: vscode.Event<vscode.Uri | undefined>
  getExecutionDetails: () => { execCommand: string[] | undefined }
}

export interface VscodePython {
  ready: Thenable<void>
  settings: Settings
}

const getPythonExtensionApi = async <T>():  Promise<T | undefined>=> {
  // activate python extension
  // TODO handle exceptions and provide error messages
  const pythonExtension = vscode.extensions.getExtension("ms-python.python");
  if (!pythonExtension){
    return;
  }

  try{
    return await pythonExtension.activate();
  }
  catch {}
};

export const getPythonExecutionPath = async (): Promise<string | undefined> => {
  // get full vscode workspace python path
  const pythonExtension = await getPythonExtensionApi<VscodePython>();
  if (!pythonExtension) {
    return;
  }

  try {
    await pythonExtension.ready;
  }
  catch {}
  
  return pythonExtension.settings.getExecutionDetails().execCommand?.join(" ");
};