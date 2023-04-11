import * as vscode from 'vscode';
import * as path from 'path';
import { SidebarProvider } from "./sidebarProvider";
import { ModuleProvider, pythonModules } from './moduleProvider';
import { ModuleCache, ModuleItem, setDifference } from './cache';
import { getPythonExecutionPath } from './python';


const CACHE_KEY = "moduleCache";


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
	const moduleCache: ModuleCache = new ModuleCache(context, CACHE_KEY);
	for (let module of await pythonModules()) {
		moduleCache.unselect(module);
	};

	// register sidebar
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider("hamilton.sidebar", new SidebarProvider(context.extensionUri))
	);

	// register module tree view
	const moduleProvider = new ModuleProvider(moduleCache);
	vscode.window.registerTreeDataProvider("hamilton.sidebar.modules", moduleProvider);
	vscode.commands.registerCommand("hamilton.sidebar.refresh", async () => moduleProvider.refresh());

	context.subscriptions.push(
		vscode.commands.registerCommand("hamilton.selectItem", module => moduleCache.select(module.uri))
	);

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

	context.subscriptions.push(
		vscode.commands.registerCommand("hamilton.buildDAG", async () => {
			if (!vscode.workspace.workspaceFolders){
				return vscode.window.showInformationMessage("No workspace folder selected");
			}

			const modules = moduleCache.values();
			if (!modules){
				return vscode.window.showWarningMessage("Hamilton: No module selected.");
			}

			const modulesPath = modules.map(m => pathToPosix(m.uri.path));
			const commandString = pythonExecutionPath.concat(["", "-m", "hamilton.experimental.vscode", ...modulesPath].join(" "));

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
