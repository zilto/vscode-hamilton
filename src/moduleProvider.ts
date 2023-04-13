import * as vscode from 'vscode';
import { ModuleCache, ModuleItem } from './cache';


// TODO better handle conversion / caching of ModuleItem to ModuleTreeItem  
export interface ModuleTreeItem extends ModuleItem {
	label: string,
	uri: vscode.Uri,
	picked: boolean,
	type: "pythonModule" | "moduleFunc" | "pythonFile",
	collapsibleState: vscode.TreeItemCollapsibleState
	symbol?: any //vscode.SymbolInformation
}


export class ModuleProvider implements vscode.TreeDataProvider<ModuleTreeItem> {
	private _onDidChangeTreeData: vscode.EventEmitter<ModuleTreeItem | undefined | null | void> = new vscode.EventEmitter<ModuleTreeItem | undefined | null | void>();
	readonly onDidChangeTreeData: vscode.Event<ModuleTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

	constructor (private fileWatcher: vscode.FileSystemWatcher) {
		this.fileWatcher.onDidChange(() => this.refresh());
	}

	public refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	async getChildren(element?: ModuleTreeItem): Promise<ModuleTreeItem[]> {
		const pythonFiles = await vscode.workspace.findFiles("**/*.py");
		return pythonFiles.map(uri => ({
			label: uri.path,
			uri: uri,
			picked: false,
			type: "pythonFile",
			collapsibleState: vscode.TreeItemCollapsibleState.None
		}));
	}

	getTreeItem(element: ModuleTreeItem): vscode.TreeItem {
		// create a TreeItem from an Entry object; handle display decoration of TreeItem
		const treeItem = new vscode.TreeItem(element.uri, element.collapsibleState);
		treeItem.contextValue = element.type;
		treeItem.iconPath = new vscode.ThemeIcon("file");
		treeItem.command = {
			command: "vscode.open",
			title: "Go to module",
			arguments: [element.uri]
		};

		return treeItem;
	}
}


export class ModuleAndSymbolProvider implements vscode.TreeDataProvider<ModuleTreeItem> {
	private _onDidChangeTreeData: vscode.EventEmitter<ModuleTreeItem | undefined | null | void> = new vscode.EventEmitter<ModuleTreeItem | undefined | null | void>();
	readonly onDidChangeTreeData: vscode.Event<ModuleTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

	constructor (private moduleCache: ModuleCache, private fileWatcher: vscode.FileSystemWatcher) {
		this.fileWatcher.onDidChange(() => this.refresh());
	}

	public refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	async getChildren(element?: ModuleTreeItem): Promise<ModuleTreeItem[]> {
		// initially called without argument, then called recursively on items where collapsibleState !== None

		// triggers on the first call; map module in cache to tree item
		if (!element) {
			const moduleItems: ModuleItem[] = this.moduleCache.values();
			return moduleItems.map(m => ({
				label: m.label,
				uri: m.uri,
				picked: m.picked,
				type: "pythonModule",
				collapsibleState: vscode.TreeItemCollapsibleState.Expanded
			}));
		}

		// triggers on recursive calls; get all python functions in python files
		else if (element && element?.type === "pythonModule") {
			const symbols: vscode.SymbolInformation[] = await vscode.commands.executeCommand("vscode.executeDocumentSymbolProvider", element.uri);
			if (!symbols){
				return [];
			}

			// filter symbols to Functions, with names not starting with "_" (private functions in Python)
			const filteredSymbols = symbols.filter(s => s.kind === vscode.SymbolKind.Function && !s.name.startsWith("_"));
			return filteredSymbols.map(s => ({
				label: s.name,
				picked: true,
				uri: element.uri,
				type: "moduleFunc",
				symbol: s,
				collapsibleState: vscode.TreeItemCollapsibleState.None
			}));
		}
		return [];
	}

	getTreeItem(element: ModuleTreeItem): vscode.TreeItem {
		// create a TreeItem from an Entry object; handle display decoration of TreeItem
		const treeItem = new vscode.TreeItem(element.uri, element.collapsibleState);
		treeItem.contextValue = element.type;
		if (element.type === "moduleFunc"){
			treeItem.label = element.symbol.name;
			treeItem.iconPath = new vscode.ThemeIcon("symbol-function");
			treeItem.command = {
				command: "editor.action.goToLocations",
				title: "Go to symbol",
				arguments: [element.uri, new vscode.Position(0, 0), [element.symbol.location], "goto"]
			};
		} else if (element.type === "pythonModule"){
			treeItem.iconPath = new vscode.ThemeIcon("file");
			treeItem.command = {
				command: "vscode.open",
				title: "Go to module",
				arguments: [element.uri]
			};
		}
		return treeItem;
	}
}
