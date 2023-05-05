import * as vscode from "vscode";
import { EXTENSION_NAME } from "./constants";
import { PythonWebSocketsFeatures } from "./features/pythonServerFeature";
import { ModuleTreeviewFeature } from "./features/moduleTreeviewFeature";
import { DagWebviewFeature } from "./features/dagWebviewFeature";
import { CacheProvider } from "./features/cacheFeature";

let extensionFeatures: any[];

export function activate(context: vscode.ExtensionContext) {
  const logger = vscode.window.createOutputChannel(EXTENSION_NAME, { log: true });
  const moduleCache: CacheProvider = CacheProvider.getInstance(context, "moduleCache");

  extensionFeatures = [
    new PythonWebSocketsFeatures(context, moduleCache, logger),
    new ModuleTreeviewFeature(context, moduleCache),
    new DagWebviewFeature(context),
  ];
}

export function deactivate() {
  extensionFeatures.forEach((feature) => feature.dispose());
}
