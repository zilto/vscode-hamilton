import * as vscode from "vscode";
import { WebSocket } from "ws";
import { IMessage } from "../messages";
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

      logger.info(`${SocketServer.logHeader} instanciating`, config);
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

    this.process.stdout?.on("message", (event) => {
      this.logger.debug(`${SocketServer.logHeader}[stdout]`, event);
    });

    this.process.stderr?.on("message", (event) => {
      this.logger.error(`${SocketServer.logHeader}[stderr]`, event);
    });

    this.process.on("close", (code) => {
      this.logger.info(`${SocketServer.logHeader} closing`, code);
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
    const that = this;

    this.socket.addEventListener("open", () => that.onOpen());
    this.socket.addEventListener("message", (e) => that.onMessage(e));
    this.socket.addEventListener("close", (e) => that.onClose(e));
    this.socket.addEventListener("error", (e) => that.onError(e));
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
    this.logger.debug(`${SocketClient.logHeader}[SEND]`, message);
  }

  // called when client receives a message
  private onMessage(event: any) {
    const message: IMessage = SocketClient.deserialize(event.data);
    this.logger.debug(`${SocketClient.logHeader}[RECEIVE]`, message);

    switch (message.command) {
      case "executeGraphResult":
        vscode.commands.executeCommand("hamilton.update", message.details.graph);

      case "error":
        this.logger.error(`${SocketClient.logHeader} Error from server`, message);
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
    if (this.socket) {
      this.logger.error(`${SocketClient.logHeader} disconnected`);
    }

    this.logger.info(`${SocketClient.logHeader} reconnecting...`);
    this.socket = new WebSocket(this.url);
    this.bindListeners();

    setTimeout(() => {
      this.socket.close();
    }, 1000);
    this.logger.info(`${SocketClient.logHeader} finally closing`);
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

  constructor(context: vscode.ExtensionContext, cacheProvider: CacheProvider, logger: vscode.LogOutputChannel) {
    this.moduleCache = cacheProvider;
    this.logger = logger;

    this.config = new SocketsConfiguration(context);

    this.server = SocketServer.getInstance(this.config, this.logger);
    this.server.start();
    // TODO use a callback from server child_process instead of timeout
    setTimeout(() => {
      this.client = new SocketClient(this.config, this.logger);
    }, 1000);

    context.subscriptions.push(
      vscode.commands.registerCommand("hamilton.compileDAG", () => {
        if (!this.client) {
          return;
        }

        // the object properties name need to match the Python ScriptConfig dataclass properties
        const scriptConfig = {
          module_file_paths: this.moduleCache.values().map((uri) => pathToPosix(uri.path)),
          upstream_nodes: [],
          downstream_nodes: [],
        };

        this.client.sendMessage({ command: "executeGraph", details: scriptConfig });
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
