import * as vscode from 'vscode';
import * as path from 'path';
import { spawn } from "child_process";
import { Buffer } from 'node:buffer';
import { ModuleProvider, ModuleAndSymbolProvider } from './moduleProvider';
import { ModuleCache, ModuleItem, setDifference } from './cache';
import { getPythonExecutionPath } from './python';
import { HamiltonDagPanel } from "./panels/HamiltonDag";


// TODO move this to a config
const MODULE_CACHE_KEY = "moduleCache";


function pathToPosix(anyPath: string): string {
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
	console.log("pythonExecutionPath", pythonExecutionPath);

	const pythonScriptPath = pathToPosix(context.asAbsolutePath(path.join("resources", "vscode.py")));
	console.log("pythonScriptPath", pythonScriptPath);
	
	// initialize selectedModules state variable
	const moduleCache: ModuleCache = new ModuleCache(context, MODULE_CACHE_KEY);
	// initialize Python file watcher to update tree view
	const pythonFileWatcher = vscode.workspace.createFileSystemWatcher("**/*.py");

	// register module tree view
	const moduleProvider = new ModuleProvider(pythonFileWatcher);
	context.subscriptions.push(
		vscode.window.registerTreeDataProvider("hamilton.pythonFiles_treeview", moduleProvider),
		vscode.commands.registerCommand("hamilton.registerModule", module => {moduleCache.unselect(module.uri); vscode.commands.executeCommand("hamilton.refreshModules"); })
	);
	
	// register module and symbol tree view
	const moduleAndSymbolProvider = new ModuleAndSymbolProvider(moduleCache, pythonFileWatcher);
	context.subscriptions.push(
		vscode.window.registerTreeDataProvider("hamilton.modules_treeview", moduleAndSymbolProvider),
		vscode.commands.registerCommand("hamilton.refreshModules", async () => moduleAndSymbolProvider.refresh()),
		vscode.commands.registerCommand("hamilton.unregisterModule", module => { moduleCache.remove(module.uri); vscode.commands.executeCommand("hamilton.refreshModules"); }),
	);
	
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
			const { selected } = moduleCache.partitionSelection();
			if (selected.length === 0){
				vscode.commands.executeCommand("hamilton.selectModules");
			}
			
			const modulesPath = selected.map(m => pathToPosix(m.uri.path));

			// the object properties name need to match the Python ScriptConfig dataclass properties
			const scriptConfig = {
				module_file_paths: modulesPath,
				upstream_nodes: [],
				downstream_nodes: [],
			}
			console.log("scriptConfig", JSON.stringify(scriptConfig))

			// spawn child_process; pass scriptConfig as JSON string
			const scriptExecution = spawn(pythonExecutionPath, [pythonScriptPath, JSON.stringify(scriptConfig)]);

			scriptExecution.stdout.on('data', (buff: Buffer) => {
				var pythonObj = JSON.parse(buff.toString("utf8"))
				console.log(pythonObj)
			});

			scriptExecution.stderr.on('data', (buff: Buffer) => {
				console.log(buff.toString("utf8"));
			});

			scriptExecution.on('exit', (code) => {
				console.log("Python script exit with code : " + code);
				vscode.window.showInformationMessage("Hamilton: Successfully built DAG!")
			});
		})
	);
}

export function deactivate(){}
