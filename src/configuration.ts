import * as vscode from "vscode";

export class Configuration {
  private static instance: Configuration;
  public pythonPath: string;
  public configPath: vscode.Uri;

  constructor(context: vscode.ExtensionContext) {
    const extension = vscode.extensions.getExtension("ms-python.python");

    this.pythonPath = extension?.exports.settings.getExecutionDetails().execCommand?.join("");
    this.configPath = vscode.Uri.joinPath(vscode.workspace.workspaceFolders[0].uri, ".hamilton");
  }

  public static getInstance(context: vscode.ExtensionContext): Configuration {
    if (!Configuration.instance) {
      Configuration.instance = new Configuration(context);
    }

    return Configuration.instance;
  }
}
