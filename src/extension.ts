import * as vscode from "vscode";
import { EXTENSION_NAME } from "./constants";
import { PythonWebSocketsFeatures } from "./features/pythonServerFeature";
import { ModuleTreeviewFeature } from "./features/moduleTreeviewFeature";
import { DagWebviewFeature } from "./features/dagWebviewFeature";
import { CacheProvider } from "./features/cacheFeature";
import { DataframeWebviewFeature } from "./features/dataframeWebviewFeature";
import { SupportLinksFeature } from "./features/supportLinksFeature";
import { LSPClientFeature } from "./features/lspClientFeature";

let extensionFeatures: any[];

export function activate(context: vscode.ExtensionContext) {
  const moduleCache: CacheProvider = CacheProvider.getInstance(context, "moduleCache");

  extensionFeatures = [
    new PythonWebSocketsFeatures(context, moduleCache),
    new ModuleTreeviewFeature(context, moduleCache),
    new DagWebviewFeature(context),
    new DataframeWebviewFeature(context),
    new SupportLinksFeature(),
    new LSPClientFeature(context)
  ];
}

export function deactivate() {
  extensionFeatures.forEach((feature) => feature.dispose());
}
