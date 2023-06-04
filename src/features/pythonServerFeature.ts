import * as vscode from "vscode";
import { WebSocket } from "ws";
import { IMessage, SocketCommand } from "../messages";
import { spawn, ChildProcess } from "child_process";
import { SocketsConfiguration } from "../configuration";
import { CacheProvider } from "./cacheFeature";
import { pathToPosix } from "../utils/pathToPosix";

// TODO add configuration to pass host:port to Python server
export class SocketServer {
  private static instance: SocketServer;
  public readonly pythonPath: string;
  public readonly serverPath: string;
  private process?: ChildProcess;
  private static logHeader = "[SocketServer]";
  private logger: vscode.LogOutputChannel;

  constructor(config: SocketsConfiguration, logger: vscode.LogOutputChannel) {
    this.logger = logger;
    this.pythonPath = config.pythonPath;
    this.serverPath = config.pythonServerPath;
  }

  public static getInstance(config: SocketsConfiguration, logger: vscode.LogOutputChannel): SocketServer {
    if (!SocketServer.instance) {
      SocketServer.instance = new SocketServer(config, logger);

      logger.info(`${SocketServer.logHeader} instantiating`, JSON.stringify(config, null, 2));
    }

    return SocketServer.instance;
  }

  public start() {
    if (this.process) {
      this.logger.debug(`${SocketServer.logHeader} an instance has already started`);
      return;
    }

    this.process = spawn(this.pythonPath, [this.serverPath]);
    this.logger.info(`${SocketServer.logHeader} started`);

    // TODO replace by .bind() notation
    const that = this;

    this.process.stdout?.on("data", (data) => {
      that.logger.debug(`${SocketServer.logHeader}[stdout]`, data.toString());
    });

    this.process.stderr?.on("data", (data) => {
      that.logger.error(`${SocketServer.logHeader}[stderr]`, data.toString());
    });

    this.process.on("close", (code) => {
      that.logger.info(`${SocketServer.logHeader} closing`, code);
    });
  }

  public stop() {
    if (this.process) {
      this.process.kill();
      this.logger.info(`${SocketServer.logHeader} manually stopped`);
    }
  }
}

export class SocketClient {
  public readonly url: string;
  private socket: WebSocket;
  private static logHeader = "[SocketClient]";
  private logger: vscode.LogOutputChannel;

  constructor(config: SocketsConfiguration, logger: vscode.LogOutputChannel) {
    this.logger = logger;
    this.url = `ws://${config.host}:${config.port}/`;

    this.socket = new WebSocket(this.url);
    this.bindListeners();
  }

  private bindListeners() {
    // ensure `this` refers to SocketClient object, and not WebSocket;
    // ref: https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener#the_value_of_this_within_the_handler
    // TODO replace by .bind() notation
    const that = this;

    this.socket.addEventListener("open", () => that.onOpen());
    this.socket.addEventListener("message", (event) => that.onMessage(event));
    this.socket.addEventListener("close", (event) => that.onClose(event));
    this.socket.addEventListener("error", (event) => that.onError(event));
  }

  public readonly readyState = () => this.socket?.readyState;

  public static serialize(message: IMessage): string {
    return JSON.stringify(message);
  }

  public static deserialize(data: string): IMessage {
    return JSON.parse(data);
  }

  public sendMessage(message: IMessage) {
    const serialized = SocketClient.serialize(message);
    this.socket.send(serialized);
    this.logger.info(`${SocketClient.logHeader}[SEND]`, message.command);
    this.logger.debug(`${SocketClient.logHeader}[SEND]`, JSON.stringify(message, null, 2));
  }

  // called when client receives a message
  private onMessage(event: any) {
    const message: IMessage = SocketClient.deserialize(event.data);
    this.logger.info(`${SocketClient.logHeader}[RECEIVE]`, message.command);
    this.logger.debug(`${SocketClient.logHeader}[RECEIVE]`, JSON.stringify(message, null, 2));

    switch (message.command) {
      case SocketCommand.executeDAG:
        vscode.commands.executeCommand("hamilton.dataframe.update", message.details.dataframe);

      case SocketCommand.compileDAG:
        vscode.commands.executeCommand("hamilton.graph.update", message.details.graph);
        break;

      case "error":
        this.logger.error(`${SocketClient.logHeader} Error from server`, JSON.stringify(message, null, 2));
        break;
    }
  }

  public close(code?: number, reason?: string) {
    this.socket.close(code, reason);
  }

  // called when client opens
  private onOpen() {
    this.logger.info(`${SocketClient.logHeader} opening on ${this.url}`);
  }

  // called when server closes
  private onClose(event: any) {
    this.logger.error(`${SocketClient.logHeader} disconnected`);

    setTimeout(() => {
      this.logger.info(`${SocketClient.logHeader} finally closing`);
    });
  }

  private onError(error: any) {
    this.close();
    this.logger.error(`${SocketClient.logHeader} encountered client error, now closing`, error);
  }
}

export class PythonWebSocketsFeatures implements vscode.Disposable {
  private readonly config: SocketsConfiguration;
  private moduleCache: CacheProvider;
  private logger: vscode.LogOutputChannel;
  private server: SocketServer;
  private client?: SocketClient;

  constructor(context: vscode.ExtensionContext, cacheProvider: CacheProvider) {
    this.moduleCache = cacheProvider;
    this.logger = vscode.window.createOutputChannel("Hamilton", { log: true });

    this.config = new SocketsConfiguration(context);

    this.server = SocketServer.getInstance(this.config, this.logger);
    this.server.start();
    // TODO use a callback from server child_process instead of timeout
    setTimeout(() => {
      this.client = new SocketClient(this.config, this.logger);
    }, 1000);
    setTimeout(() => {
      this.client?.sendMessage({command: "registerConnection", details: {identity: "vscode"}})
    }, 2000)

    
    context.subscriptions.push(
      vscode.commands.registerCommand("hamilton.logger.focus", () => this.logger.show())
    )

    context.subscriptions.push(
      vscode.commands.registerCommand("hamilton.compileDAG", () => {
        if (!this.client) {
          vscode.window.showErrorMessage("Hamilton: No Python client started.");
          return;
        }

        // the details property name need to match the Python ScriptConfig dataclass properties
        this.client.sendMessage({
          command: SocketCommand.compileDAG,
          details: {
            module_file_paths: this.moduleCache.values().map((uri) => pathToPosix(uri.path)),
            upstream_nodes: [],
            downstream_nodes: [],
            config_path: "",
          },
        });
      }),
    );

    context.subscriptions.push(
      vscode.commands.registerCommand("hamilton.executeDAG", async () => {
        if (!this.client) {
          vscode.window.showErrorMessage("Hamilton: No Python client started.");
          return;
        }
        const configUri = vscode.Uri.joinPath(vscode.workspace.workspaceFolders[0].uri, "./.hamilton")
        try {
          let stats = await vscode.workspace.fs.stat(configUri)
          // the details property name need to match the Python ScriptConfig dataclass properties
          this.client.sendMessage({
            command: SocketCommand.executeDAG,
            details: {
              module_file_paths: this.moduleCache.values().map((uri) => pathToPosix(uri.path)),
              upstream_nodes: [],
              downstream_nodes: [],
              config_path: configUri.path,
              output_columns: [],
            },
          })
        } catch {
          vscode.commands.executeCommand("hamilton.compileDAG")
          vscode.window.showWarningMessage("`executeDAG` failed. `.hamilton` not found.")
        }
      }),
    );
  }

  public dispose(): any {
    if (this.client) {
      this.client.close(1000, "VSCode extension deactivated.");
    }
    this.server.stop();
  }
}
