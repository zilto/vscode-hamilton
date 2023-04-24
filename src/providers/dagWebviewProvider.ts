import * as vscode from "vscode";
import { getNonce } from "../utils/getNonce";
import { getUri } from "../utils/getUri";

export class dagWebviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewId = "hamilton.DAG_webview";
  public _view?: vscode.WebviewView;

  constructor(private readonly _extensionUri: vscode.Uri) {}

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

    // no event currently implemented
    webviewView.webview.onDidReceiveMessage((message: any) => {
      const command = message.command;
      switch (command) {
      }
    }, undefined);
  }

  public updateElements(data: any) {
    this._view?.webview.postMessage({ command: "updateElements", details: data });
  }

  public rotate(){
    console.log("dagprovider.rotate")
    this._view?.webview.postMessage({ command: "rotate", details: null})
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
}
