import * as vscode from "vscode";
import { WebSocket } from "ws";
import { IMessage } from "../messages";
import { spawn, ChildProcess } from "child_process";
import { SocketsConfiguration } from "../configuration";
import { CacheProvider } from "./cacheFeature";
import { pathToPosix } from "../utils/pathToPosix";

// TODO add configuration to pass host:port to Python server
export class SocketServer {
  public readonly pythonPath: string;
  public readonly serverPath: string;
  private process?: ChildProcess;

  constructor(public readonly config: SocketsConfiguration) {
    this.pythonPath = config.pythonPath;
    this.serverPath = config.pythonServerPath;
  }

  public start() {
    if (this.process) {
      console.log("[SocketServer] is already running.");
    } else {
      this.process = spawn(this.pythonPath, [this.serverPath]);
      console.log("[SocketServer] started.");

      this.process.stdout?.on("message", (event) => {
        console.log("[SocketServer][stdout]", event);
      });

      this.process.stderr?.on("message", (event) => {
        console.log("[SocketServer][stderr]", event);
      });

      this.process.on("close", (code) => {
        console.log("[SocketServer]", "close", code);
      });
    }
  }

  public stop() {
    if (this.process) {
      this.process.kill();
    } else {
      console.log("[SocketServer] killed.");
    }
  }
}

export class SocketClient {
  public readonly url: string;
  private socket: WebSocket;
  outputChannel: vscode.LogOutputChannel;

  constructor(config: SocketsConfiguration) {
    this.url = `ws://${config.host}:${config.port}/`;

    let socket = new WebSocket(this.url);
    this.socket = this.bindListeners(socket);

    this.outputChannel = vscode.window.createOutputChannel("Hamilton: Python server", { log: true });
  }

  private bindListeners(socket: WebSocket): WebSocket {
    socket.addEventListener("open", this.onOpen);
    socket.addEventListener("message", this.onMessage);
    socket.addEventListener("close", this.onClose);
    socket.addEventListener("error", this.onError);
    return socket;
  }

  public readonly readyState = () => this.socket.readyState;

  public static serialize(message: IMessage): string {
    return JSON.stringify(message);
  }

  public static deserialize(data: string): IMessage {
    return JSON.parse(data);
  }

  public sendMessage(message: IMessage) {
    console.log("[SocketClient][SEND]", message);
    const serialized = SocketClient.serialize(message);
    this.socket.send(serialized);
  }

  public close(code?: number, reason?: string) {
    this.socket.close(code, reason);
  }

  // called when websocket client opens
  private onOpen() {
    console.log("[SocketClient] onopen");
  }

  // called when websocket server closes
  private onClose(event: any) {
    console.error("[SocketClient] onclose");
    if (this.socket) {
      console.error("[SocketClient] Disconnected");
    }

    let reconnectSocket = new WebSocket(this.url);
    this.socket = this.bindListeners(reconnectSocket);

    setTimeout(() => {
      this.socket.close();
    }, 1000);
  }

  // called when websocket client receives a message
  private onMessage(event: any) {
    const message: IMessage = SocketClient.deserialize(event.data);

    switch (message.command) {
      case "executeGraphResult":
        vscode.commands.executeCommand("hamilton.update", message.details.graph);

      case "error":
        console.log("ErrorEvent", message);
    }
  }

  private onError(error: any) {
    console.error(`[SocketClient] Encountered error ${error}. Closing.`);
    this.close();
  }
}

export class PythonWebSocketsFeatures implements vscode.Disposable {
  private readonly config: SocketsConfiguration;
  private moduleCache: CacheProvider;
  private server: SocketServer;
  private client?: SocketClient;

  constructor(context: vscode.ExtensionContext, cacheProvider: CacheProvider) {
    this.moduleCache = cacheProvider;
    this.config = new SocketsConfiguration(context);
    this.server = new SocketServer(this.config);

    this.server.start();
    // TODO use a callback from server child_process instead of timeout
    setTimeout(() => {
      this.client = new SocketClient(this.config);
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
