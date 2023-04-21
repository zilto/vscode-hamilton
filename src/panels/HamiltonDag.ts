import * as vscode from 'vscode';
import {getNonce} from "../utils/getNonce"
import {getUri} from "../utils/getUri"


export class HamiltonDagPanel {
  public static currentPanel: HamiltonDagPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];

  constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._disposables = [];
    this._panel = panel;
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    this._panel.webview.html = this._getWebviewContent(this._panel.webview, extensionUri);
    this._setWebviewMessageListener(this._panel.webview);
  }

  static render(extensionUri: vscode.Uri) {
    if (HamiltonDagPanel.currentPanel) {
      HamiltonDagPanel.currentPanel._panel.reveal(vscode.ViewColumn.One);
    } else {
      const panel = vscode.window.createWebviewPanel(
        "hamiltonDag",
        "Hamilton: DAG",
        vscode.ViewColumn.One,
        {
          enableScripts: true
        }
      );
      HamiltonDagPanel.currentPanel = new HamiltonDagPanel(panel, extensionUri);
    }
  }

  dispose() {
    HamiltonDagPanel.currentPanel = void 0;
    this._panel.dispose();
    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
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
          <title>Hamilton DAG</title>
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
          <h1>Hamilton DAG</h1>
          <div id="cy"/>
          <div id="root"></div>
          <script type="module" nonce="${nonce}" src="${webviewUri}"></script>
        </body>
      </html>
    `
    );
  }
  _setWebviewMessageListener(webview: vscode.Webview) {
    webview.onDidReceiveMessage(
      (message: any) => {
        const command = message.command;
        switch (command) {
          case "updateElements":
            vscode.window.showInformationMessage(message.text);
            return;
        }
      },
      undefined,
      this._disposables
    );
  }
};