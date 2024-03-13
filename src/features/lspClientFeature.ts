import * as vscode from "vscode";
import { LanguageClient, LanguageClientOptions, ServerOptions } from "vscode-languageclient/node";

export class LSPClientFeature implements vscode.Disposable {
  private client: LanguageClient;

  constructor(context: vscode.ExtensionContext, pythonPath: string) {
    const serverOptions: ServerOptions = {
      command: pythonPath,
      args: ["-m", "lsp_server"], // the entry point is /lspServer/__main__.py
      options: { cwd: context.asAbsolutePath("") },
    };

    const outputChannel = vscode.window.createOutputChannel("Hamilton LSP", { log: true });
    const clientOptions: LanguageClientOptions = {
      documentSelector: [
        { scheme: "file", language: "python" },
        { scheme: "untitle", language: "python" },
      ],
      outputChannel: outputChannel,
      traceOutputChannel: outputChannel,
    };

    this.client = new LanguageClient("hamilton-lsp", "Hamilton Language Server", serverOptions, clientOptions);
    this.client.start();
    this.bindEventListener();
  }

  private bindEventListener() {
    this.client.onNotification("lsp/showDAG", (json_graph) => {
      vscode.commands.executeCommand("hamilton.dagWebview.update", json_graph);
    });

  }

  public dispose(): any {
    if (!this.client) {
      undefined;
    }
    this.client.stop();
  }
}
