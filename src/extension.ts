import * as vscode from "vscode";
import { DataflowWebviewFeature } from "./features/dataflowWebviewFeature";
import { LSPClientFeature } from "./features/lspClientFeature";
import { SupportLinksFeature } from "./features/supportLinksFeature";

let extensionFeatures: any[];

export async function activate(context: vscode.ExtensionContext) {
  const pythonExtension = vscode.extensions.getExtension("ms-python.python");
  const pythonPath = pythonExtension?.exports.settings.getExecutionDetails().execCommand?.join("");

  extensionFeatures = [
    new DataflowWebviewFeature(context),
    new LSPClientFeature(context, pythonPath),
    new SupportLinksFeature(),
  ];
}

export function deactivate() {
  extensionFeatures.forEach((feature) => feature.dispose());
}
