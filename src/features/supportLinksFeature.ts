import * as vscode from "vscode";


class DummyProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  public static readonly viewId = "hamilton.supportLinks_treeview";

  constructor() {}

  async getChildren() {
    return [];
  }

  getTreeItem(element: vscode.TreeItem) {
    return element;
  }
}

export class SupportLinksFeature implements vscode.Disposable{
  private readonly treeview: vscode.TreeView<vscode.TreeItem>

  constructor(){
    this.treeview = vscode.window.createTreeView("hamilton.supportLinks_treeview", {treeDataProvider: new DummyProvider()})
  }

  public dispose(): any {
    return undefined;
  }
}