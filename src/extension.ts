import * as vscode from 'vscode';
import * as path from 'path';
import { ModuleProvider, ModuleAndSymbolProvider } from './moduleProvider';
import { ModuleCache, ModuleItem, setDifference } from './cache';
import { getPythonExecutionPath } from './python';


export function pathToPosix(anyPath: string): string {
    return anyPath.split(path.sep).join(path.posix.sep);
}


export async function activate(context: vscode.ExtensionContext): Promise<void> {
	// TODO handle promise resolve more gracefully
	const pythonExecutionPath = await getPythonExecutionPath().then(
		p => {return p ? pathToPosix(p) : undefined; }
	);
	if (!pythonExecutionPath) {
		return;
	}
	
	// initialize selectedModules state variable
	const moduleCache: ModuleCache = new ModuleCache(context, "moduleCache");
	// initialize Python file watcher to update tree view
	const pythonFileWatcher = vscode.workspace.createFileSystemWatcher("**/*.py");

	// register module tree view
	const moduleProvider = new ModuleProvider(pythonFileWatcher);
	vscode.window.registerTreeDataProvider("hamilton.sidebar.pythonFiles", moduleProvider);
	vscode.commands.registerCommand("hamilton.registerModule", module => {moduleCache.unselect(module.uri); vscode.commands.executeCommand("hamilton.sidebar.refresh")});
	
	// register module and symbol tree view
	const moduleAndSymbolProvider = new ModuleAndSymbolProvider(moduleCache, pythonFileWatcher);
	vscode.window.registerTreeDataProvider("hamilton.sidebar.modules", moduleAndSymbolProvider);
	vscode.commands.registerCommand("hamilton.sidebar.refresh", async () => moduleAndSymbolProvider.refresh());
	vscode.commands.registerCommand("hamilton.unregisterModule", module => {moduleCache.remove(module.uri); vscode.commands.executeCommand("hamilton.sidebar.refresh")});

	
	// register selectModules command
	context.subscriptions.push(
		vscode.commands.registerCommand("hamilton.selectModules", async () => {
			// find .py files in workspace
			const items: ModuleItem[] = moduleCache.values();
			if (!items){
				return;
			}

			// ui prompt to multiselect 
			let selection = await vscode.window.showQuickPick(
				items,
				{"title": "Hamilton: Module selection",
				 "placeHolder": "Select modules to visualize...",
				 "canPickMany": true
				}
			);
			if (!selection){
				selection = [];
			}

			// vscode quickPick return selected, but not unselected item; find set difference to update cache
			const selectedUriString: string[] = selection.map(s => {return s.uri.toString(); });
			const unselectedUriString: string[] = setDifference(moduleCache.keys(), selectedUriString);

			for (let uriString of selectedUriString) {
				moduleCache.select(vscode.Uri.parse(uriString));
			};

			for (let uriString of unselectedUriString) {
				moduleCache.unselect(vscode.Uri.parse(uriString));
			};
		})
	);

	// register buildDAG command
	context.subscriptions.push(
		vscode.commands.registerCommand("hamilton.buildDAG", async () => {
			if (!vscode.workspace.workspaceFolders){
				return vscode.window.showInformationMessage("No workspace folder selected");
			}

			const { selected } = moduleCache.partitionSelection();
			if (selected.length === 0){
				vscode.commands.executeCommand("hamilton.selectModules");
			}

			const modulesPath = selected.map(m => pathToPosix(m.uri.path));
			const commandString = pythonExecutionPath.concat(["", "-m", "hamilton.vscode", ...modulesPath].join(" "));

			const terminal = vscode.window.createTerminal({
				"cwd": vscode.workspace.workspaceFolders[0].uri,
				"hideFromUser": true
			});
			terminal.sendText(commandString);
			vscode.window.showInformationMessage("Hamilton: Building DAG...");
		})
	);
}

export function deactivate(){}
