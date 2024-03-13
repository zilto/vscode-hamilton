import * as vscode from "vscode";
import { ModuleTreeviewFeature } from "./features/moduleTreeviewFeature";
import { DagWebviewFeature } from "./features/dagWebviewFeature";
import { CacheProvider } from "./features/cacheFeature";
import { SupportLinksFeature } from "./features/supportLinksFeature";
import { LSPClientFeature } from "./features/lspClientFeature";

let extensionFeatures: any[];

export async function activate(context: vscode.ExtensionContext) {
  const pythonExtension = vscode.extensions.getExtension("ms-python.python");
  const pythonPath = pythonExtension?.exports.settings.getExecutionDetails().execCommand?.join("");

  const configUri: vscode.Uri = vscode.Uri.joinPath(vscode.workspace.workspaceFolders[0].uri, "./.hamilton");
  const config = await vscode.workspace.fs.readFile(configUri).then((data) => JSON.parse(data.toString()));
  const moduleCache: CacheProvider = CacheProvider.getInstance(context, "moduleCache");

  extensionFeatures = [
    new LSPClientFeature(context, pythonPath),
    new ModuleTreeviewFeature(context, moduleCache),
    new DagWebviewFeature(context),
    new SupportLinksFeature(),
  ];
}

export function deactivate() {
  extensionFeatures.forEach((feature) => feature.dispose());
}
