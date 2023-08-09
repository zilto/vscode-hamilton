import * as vscode from "vscode";
import { getNonce } from "../utils/getNonce";
import { getUri } from "../utils/getUri";
import { IMessage, DagCommand } from "../messages";

// TODO add webviewer serializer for VSCode caching
class DagWebviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewId = "hamilton.DAG_webview";
  private readonly _extensionUri: vscode.Uri;
  public _view?: vscode.WebviewView;

  constructor(context: vscode.ExtensionContext) {
    this._extensionUri = context.extensionUri;
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void | Thenable<void> {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    // TODO remove this event after implementing webview state caching
    webviewView.onDidChangeVisibility(() => {
      vscode.commands.executeCommand("hamilton.showDAG");
    });

    webviewView.webview.html = this._getWebviewContent(webviewView.webview, this._extensionUri);

    webviewView.webview.onDidReceiveMessage((message: IMessage) => {
      switch (message.command) {
        case DagCommand.save:
          this.handleSave(message);
          break;

        case DagCommand.goToDefinition:
          this.goToDefinition(message);
          break;
      }
    }, undefined);
  }

  public postMessage(message: IMessage) {
    if (this._view?.webview) {
      this._view?.webview.postMessage(message);
    }
  }

  private handleSave(message: IMessage) {
    const filename = "hamilton." + message.details.format;
    const content = Buffer.from(message.details.content);
    vscode.window
      .showSaveDialog({
        defaultUri: vscode.Uri.joinPath(vscode.workspace.workspaceFolders[0].uri, filename),
        saveLabel: "Save DAG",
        title: "Hamilton: Save DAG",
      })
      .then((uri) => vscode.workspace.fs.writeFile(uri, content));
  }

  private async goToDefinition(message: IMessage) {
    const moduleUri = await vscode.workspace.findFiles(`**/${message.details.module}.py`).then((uris) => uris[0]);

    const symbols: vscode.SymbolInformation[] = await vscode.commands.executeCommand(
      "vscode.executeDocumentSymbolProvider",
      moduleUri,
    );

    const requestedSymbol = symbols.filter((s) => s.name === message.details.name)[0];
    if (!requestedSymbol) {
      vscode.window.showWarningMessage(
        `Requested function ${message.details.name} not found in module ${message.details.module}`,
      );
      return;
    }

    vscode.commands.executeCommand(
      "editor.action.goToLocations",
      moduleUri,
      new vscode.Position(0, 0),
      [requestedSymbol.location],
      "goto",
      "Not found",
    );
  }

  public _getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri) {
    const scriptUri = getUri(webview, extensionUri, ["out", "dagScript.js"]);
    const cssUri = getUri(webview, extensionUri, ["out", "dag.css"]);

    const nonce = getNonce();
    return (
      /*html*/
      `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Hamilton: DAG Viewer</title>
          <link href="${cssUri}" rel="stylesheet">
          <style>
            #cy {
              width: 100%;
              height: 100%;
              position: absolute;
              top: 0px;
              left: 0px;
            }
          </style>
        </head>
        <body>
          <div id="cy"/>
          <div id="root"></div>
          <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
        </body>
      </html>
      `
    );
  }
}

export class DagWebviewFeature implements vscode.Disposable {
  private dagWebviewProvider: DagWebviewProvider;

  constructor(context: vscode.ExtensionContext) {
    this.dagWebviewProvider = new DagWebviewProvider(context);

    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider(DagWebviewProvider.viewId, this.dagWebviewProvider),
      vscode.commands.registerCommand("hamilton.dagWebview.update", (data) => {
        this.dagWebviewProvider.postMessage({ command: DagCommand.update, details: data });
      }),
      vscode.commands.registerCommand("hamilton.dagWebview.rotate", () => {
        this.dagWebviewProvider.postMessage({ command: DagCommand.rotate, details: null });
      }),
      vscode.commands.registerCommand("hamilton.dagWebview.save", () => {
        let format = "svg";
        this.dagWebviewProvider.postMessage({ command: DagCommand.save, details: { format: format } });
      }),
      vscode.commands.registerCommand("hamilton.dagWebview.expandAll", () =>
        this.dagWebviewProvider.postMessage({ command: DagCommand.expandAll, details: null }),
      ),
      vscode.commands.registerCommand("hamilton.dagWebview.collapseAll", () =>
        this.dagWebviewProvider.postMessage({ command: DagCommand.collapseAll, details: null }),
      ),
    );
  }

  public dispose(): any {
    return undefined;
  }
}
