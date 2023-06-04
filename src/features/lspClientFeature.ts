// import * as net from "net";
// import * as path from "path";
import * as vscode from "vscode";
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from "vscode-languageclient/node";
import { SocketsConfiguration } from "../configuration";


export class LSPClientFeature implements vscode.Disposable {
  private client: LanguageClient;

  constructor(context: vscode.ExtensionContext) {
    // const serverModule = context.asAbsolutePath(path.join("lsp", "out", "server.js"));
    // const debugOptions = { execArgv: ["--nolazy", "--inspect=6009"] };
    // const serverOptions: ServerOptions = {
    //   debug: {
    //     module: serverModule,
    //     options: debugOptions,
    //     transport: TransportKind.ipc,
    //   },
    //   run: { module: serverModule, transport: TransportKind.ipc },
    // };

    const config = new SocketsConfiguration(context)

    const serverOptions: ServerOptions = {
      command: config.pythonPath,
      args: ["-m", "lspServer"],  // the entry point is /lspServer/__main__.py
      options: { cwd: context.asAbsolutePath("") }
    }

    const clientOptions: LanguageClientOptions = {
      documentSelector: [
        { scheme: "file", language: "python" },
      ],
      synchronize: {
        fileEvents: vscode.workspace.createFileSystemWatcher("**/.clientrc"),
      },
      outputChannel: vscode.window.createOutputChannel("Hamilton LSP", {log: true})
    };

    this.client = new LanguageClient("hamilton-lsp", "Hamilton Language Server", serverOptions, clientOptions);

    this.client.start();
  }

  private commandHandler(): void {
    this.client.onNotification("$/test", (msg) => vscode.window.showInformationMessage(msg))
  }

  public dispose(): any {
    if (!this.client) {
      undefined;
    }
    this.client.stop();
  }
}
