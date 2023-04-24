import * as vscode from "vscode";
import * as path from "path";
import { execFile } from "child_process";
import { dagWebviewProvider } from "./providers/dagWebviewProvider";
import { PythonFilesProvider, ModulesProvider } from "./providers/moduleTreeviewProvider";
import { ModuleCache, ModuleItem, setDifference } from "./cache";
import { getPythonExecutionPath } from "./python";
import { pathToPosix } from "./utils/pathToPosix";

export async function activate(context: vscode.ExtensionContext) {
  const pythonExecutionPath = await getPythonExecutionPath();
  if (!pythonExecutionPath) {
    vscode.window.showWarningMessage("Hamilton: pythonExecutionPath is `undefined`");
    return;
  }

  const pythonScriptPath = pathToPosix(context.asAbsolutePath(path.join("resources", "vscode.py")));

  const moduleCache: ModuleCache = new ModuleCache(context, "moduleCache");

  // filewatch is shared by the two treeviews
  const pythonFileWatcher = vscode.workspace.createFileSystemWatcher("**/*.py");

  // register modules treeview
  const modulesProvider = new ModulesProvider(moduleCache, pythonFileWatcher);
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider(ModulesProvider.viewId, modulesProvider),
    vscode.commands.registerCommand("hamilton.refreshModules", () => modulesProvider.refresh()),
    vscode.commands.registerCommand("hamilton.unregisterModule", (module) => {
      moduleCache.remove(module.uri);
      vscode.commands.executeCommand("hamilton.refreshModules");
    }),
  );

  // register python files treeview
  const pythonFilesProvider = new PythonFilesProvider(pythonFileWatcher);
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider(PythonFilesProvider.viewId, pythonFilesProvider),
    vscode.commands.registerCommand("hamilton.registerModule", (module) => {
      moduleCache.unselect(module.uri);
      vscode.commands.executeCommand("hamilton.refreshModules");
    }),
  );

  // register dag webview
  const hamiltonDagProvider = new dagWebviewProvider(context?.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(dagWebviewProvider.viewId, hamiltonDagProvider),
    vscode.commands.registerCommand("hamilton.rotate", () => hamiltonDagProvider.rotate())
  );


  // register selectModules command
  context.subscriptions.push(
    vscode.commands.registerCommand("hamilton.selectModules", async () => {
      const items: ModuleItem[] = moduleCache.values();
      if (!items) {
        console.log("!items", items);
        return;
      }

      // vscode quickPick return selected, but not unselected item; find set difference to update cache
      const selected = await vscode.window
        .showQuickPick(items, {
          title: "Hamilton: Module selection",
          placeHolder: "Select modules to visualize...",
          canPickMany: true,
        })
        .then((selection) => (selection ? selection : []));

      selected.map((item) => {
        moduleCache.select(item.uri);
      });

      const unselected: string[] = setDifference(
        moduleCache.keys(),
        selected.map((item) => item.uri.toString()),
      );
      unselected.map((uriString) => moduleCache.unselect(vscode.Uri.parse(uriString)));
    }),
  );

  // register compileDAG  command
  context.subscriptions.push(
    vscode.commands.registerCommand("hamilton.compileDAG", async () => {
      const { selected } = moduleCache.partitionSelection();
      if (selected.length === 0) {
        vscode.commands.executeCommand("hamilton.selectModules");
      }

      const modulesPath = selected.map((m) => pathToPosix(m.uri.path));

      // the object properties name need to match the Python ScriptConfig dataclass properties
      const scriptConfig = {
        module_file_paths: modulesPath,
        upstream_nodes: [],
        downstream_nodes: [],
      };

      function parseStdout(stdout: string): string {
        const regex = /(?<=#{3})(?<response>.*)(?=#{3})/;
        const match = stdout.match(regex);
        if (match?.groups?.response) {
          return JSON.parse(match.groups?.response);
        } else {
          return "";
        }
      }

      execFile(pythonExecutionPath, [pythonScriptPath, JSON.stringify(scriptConfig)], (error, stdout, stderr) => {
        if (error) {
          console.log("scriptExecution JS error", error);
        }

        if (stderr) {
          console.log("scriptExecution Python error", stderr);
          vscode.window.showErrorMessage("Hamilton: Error executing Python script");
        } else if (stdout) {
          const graphData = parseStdout(stdout);
          if (graphData) {
            hamiltonDagProvider.updateElements(graphData);
          }
        }
      });
    }),
  );
}

export function deactivate() {}
