import * as vscode from "vscode";
import { CacheProvider } from "./cacheFeature";

class Item extends vscode.TreeItem {
  constructor(public resourceUri: vscode.Uri) {
    super(resourceUri);
  }
}

class PythonFileTreeItem extends Item {
  contextValue = "pythonFile";
  collapsibleState = vscode.TreeItemCollapsibleState.None;
  iconPath = new vscode.ThemeIcon("file");
  command = {
    command: "vscode.open",
    title: "Go to module",
    arguments: [this.resourceUri],
  };
}

class ModuleTreeItem extends Item {
  contextValue = "pythonModule";
  collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
  iconPath = new vscode.ThemeIcon("file");
  command = {
    command: "vscode.open",
    title: "Go to module",
    arguments: [this.resourceUri],
  };
}

class FunctionTreeItem extends Item {
  constructor(public resourceUri: vscode.Uri, public symbol: vscode.SymbolInformation) {
    super(resourceUri);
  }

  label = this.symbol.name;
  contextValue = "moduleFunc";
  collapsibleState = vscode.TreeItemCollapsibleState.None;
  iconPath = new vscode.ThemeIcon("symbol-function");
  command = {
    command: "editor.action.goToLocations",
    title: "Go to symbol",
    arguments: [this.resourceUri, new vscode.Position(0, 0), [this.symbol?.location], "goto"],
  };
}

class PythonFilesProvider implements vscode.TreeDataProvider<Item> {
  public static readonly viewId = "hamilton.pythonFiles_treeview";

  private _onDidChangeTreeData: vscode.EventEmitter<Item | undefined | null | void> = new vscode.EventEmitter<
    Item | undefined | null | void
  >();
  readonly onDidChangeTreeData: vscode.Event<Item | undefined | null | void> = this._onDidChangeTreeData.event;

  constructor(private fileWatcher: vscode.FileSystemWatcher) {
    this.fileWatcher.onDidChange(() => this.refresh());
  }

  public refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  async getChildren(element?: Item): Promise<Item[]> {
    const pythonFiles = await vscode.workspace.findFiles("**/*.py");
    return pythonFiles.map((uri) => new PythonFileTreeItem(uri));
  }

  getTreeItem(element: Item): vscode.TreeItem {
    return element;
  }
}

class ModulesProvider implements vscode.TreeDataProvider<Item> {
  public static readonly viewId = "hamilton.modules_treeview";

  private _onDidChangeTreeData: vscode.EventEmitter<Item | undefined | null | void> = new vscode.EventEmitter<
    Item | undefined | null | void
  >();
  readonly onDidChangeTreeData: vscode.Event<Item | undefined | null | void> = this._onDidChangeTreeData.event;

  constructor(private fileWatcher: vscode.FileSystemWatcher, private moduleCache: CacheProvider) {
    this.fileWatcher.onDidChange(() => this.refresh());
  }

  public refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  async getChildren(element?: Item): Promise<Item[]> {
    // triggers on the first call; map module in cache to tree item
    if (!element) {
      return this.moduleCache.values().map((uri) => new ModuleTreeItem(uri));
    }

    // triggers on recursive calls; get all python functions in python files
    else if (element && element instanceof ModuleTreeItem) {
      const symbols: vscode.SymbolInformation[] = await vscode.commands.executeCommand(
        "vscode.executeDocumentSymbolProvider",
        element.resourceUri,
      );
      if (!symbols) {
        return [];
      }

      // filter symbols to Functions, with names not starting with "_" (private functions in Python)
      const filteredSymbols = symbols.filter((s) => s.kind === vscode.SymbolKind.Function && !s.name.startsWith("_"));
      return filteredSymbols.map((symbol) => new FunctionTreeItem(element.resourceUri, symbol));
    }
    return [];
  }

  getTreeItem(element: Item): vscode.TreeItem {
    return element;
  }
}

export class ModuleTreeviewFeature implements vscode.Disposable {
  private filewatcher: vscode.FileSystemWatcher;
  private moduleCache: CacheProvider;
  private modulesProvider: ModulesProvider;
  private pythonFilesProvider: PythonFilesProvider;

  constructor(context: vscode.ExtensionContext, cacheProvider: CacheProvider) {
    this.filewatcher = vscode.workspace.createFileSystemWatcher("**/*.py");
    this.moduleCache = cacheProvider;
    this.modulesProvider = new ModulesProvider(this.filewatcher, this.moduleCache);
    this.pythonFilesProvider = new PythonFilesProvider(this.filewatcher);

    // register modulesProvider
    context.subscriptions.push(
      vscode.window.registerTreeDataProvider(ModulesProvider.viewId, this.modulesProvider),
      vscode.commands.registerCommand("hamilton.refreshModules", () => this.modulesProvider.refresh()),
      vscode.commands.registerCommand("hamilton.unregisterModule", (module) => {
        // the promise ensures the cache is updated before refresh
        Promise.resolve(this.moduleCache.remove(module.resourceUri)).then(() =>
          vscode.commands.executeCommand("hamilton.refreshModules"),
        );
      }),
    );

    // register pythonFilesProvider
    context.subscriptions.push(
      vscode.window.registerTreeDataProvider(PythonFilesProvider.viewId, this.pythonFilesProvider),
      vscode.commands.registerCommand("hamilton.registerModule", (module) => {
        // the promise ensures the cache is updated before refresh
        Promise.resolve(this.moduleCache.add(module.resourceUri)).then(() =>
          vscode.commands.executeCommand("hamilton.refreshModules"),
        );
      }),
    );
  }

  public dispose(): any {
    return undefined;
  }
}
