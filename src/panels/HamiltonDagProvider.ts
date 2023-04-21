import * as vscode from 'vscode';
import {getNonce} from "../utils/getNonce"
import {getUri} from "../utils/getUri"


// TODO define DAG data interface

export class HamiltonDagProvider implements vscode.WebviewViewProvider{
  public static readonly viewType = "hamilton.DagPanel"
  public _view?: vscode.WebviewView;

  private _onDidChangeDAGData: vscode.EventEmitter<any | undefined | null | void> = new vscode.EventEmitter<any | undefined | null | void>();
  readonly onDidChangeDAGData: vscode.Event<any | undefined | null | void> = this._onDidChangeDAGData.event;

  constructor(
    private readonly _extensionUri: vscode.Uri,
  ) {}

  public refresh(): void {
    this._onDidChangeDAGData.fire(null);
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
    
    webviewView.webview.onDidReceiveMessage(
      (message: any) => {
        const command = message.command;
        switch (command) {
          case "updateElements":
            vscode.window.showInformationMessage(message.text);
            return;
        }
      },
      undefined,
    );
  }

  public updateElements(data: any){
    console.log("from DAG provideR", data)
    this._view?.webview.postMessage({command: "updateElements", data: data})
    this.refresh()
  }

  _getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri) {
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
};