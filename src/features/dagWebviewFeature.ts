import * as vscode from "vscode";
import { getNonce } from "../utils/getNonce";
import { getUri } from "../utils/getUri";
import { IMessage, DagSaveMessage } from "../messages";

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

    webviewView.webview.html = this._getWebviewContent(webviewView.webview, this._extensionUri);

    webviewView.webview.onDidReceiveMessage((message: IMessage) => {
      switch (message.command) {
        case "save":
          this.handleSave(message);
      }
    }, undefined);
  }

  public postMessage(message: IMessage) {
    if (this._view?.webview) {
      this._view?.webview.postMessage(message);
    }
  }

  private handleSave(message: DagSaveMessage) {
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

  public _getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri) {
    const webviewUri = getUri(webview, extensionUri, ["out", "webview.js"]);
    const nonce = getNonce();
    return (
      /*html*/
      `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Hamilton DAG Panel Provider</title>
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
          <script type="module" nonce="${nonce}" src="${webviewUri}"></script>
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
      vscode.commands.registerCommand("hamilton.update", (data) => {
        this.dagWebviewProvider.postMessage({ command: "update", details: data });
      }),
      vscode.commands.registerCommand("hamilton.rotate", () => {
        this.dagWebviewProvider.postMessage({ command: "rotate", details: null });
      }),
      vscode.commands.registerCommand("hamilton.save", () => {
        let format = "svg";
        this.dagWebviewProvider.postMessage({ command: "save", details: { format: format } });
      }),
      vscode.commands.registerCommand("hamilton.expandAll", () =>
        this.dagWebviewProvider.postMessage({ command: "expandAll", details: null }),
      ),
      vscode.commands.registerCommand("hamilton.collapseAll", () =>
        this.dagWebviewProvider.postMessage({ command: "collapseAll", details: null }),
      ),
    );
  }

  public dispose(): any {
    return undefined;
  }
}
