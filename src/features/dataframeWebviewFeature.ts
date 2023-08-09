import * as vscode from "vscode";
import { getNonce } from "../utils/getNonce";
import { getUri } from "../utils/getUri";
import { IMessage, DataframeCommand } from "../messages";

class DataframeWebviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewId = "hamilton.Dataframe_webview";
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
  }

  public postMessage(message: IMessage) {
    if (this._view?.webview) {
      this._view?.webview.postMessage(message);
    }
  }

  public _getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri) {
    const scriptUri = getUri(webview, extensionUri, ["out", "dataframeScript.js"]);
    const cssUri = getUri(webview, extensionUri, ["out", "dataframe.css"]);

    const nonce = getNonce();
    return (
      /*html*/
      `
      <!DOCTYPE html>
      <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Hamilton: DAG Results</title>
            <link href="${cssUri}" rel="stylesheet">
        </head>
        <body>
            <div id="result"/>
            <div id="root"/>
            <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
        </body>
      </html>
      `
    );
  }
}

export class DataframeWebviewFeature implements vscode.Disposable {
  private dataframeWebviewProvider: DataframeWebviewProvider;

  constructor(context: vscode.ExtensionContext) {
    this.dataframeWebviewProvider = new DataframeWebviewProvider(context);

    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider(DataframeWebviewProvider.viewId, this.dataframeWebviewProvider),
      vscode.commands.registerCommand("hamilton.dataframeWebview.update", (data) => {
        this.dataframeWebviewProvider.postMessage({ command: DataframeCommand.update, details: data });
      }),
    );
  }

  public dispose(): any {
    return undefined;
  }
}
