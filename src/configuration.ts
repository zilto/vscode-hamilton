import * as vscode from "vscode";
import * as path from "path";
import { pathToPosix } from "./utils/pathToPosix";

export class SocketsConfiguration {
  public pythonPath: string;
  public pythonServerPath: string;
  public host: string;
  public port: number;

  constructor(context: vscode.ExtensionContext) {
    const extension = vscode.extensions.getExtension("ms-python.python");
    
    this.pythonPath = extension?.exports.settings.getExecutionDetails().execCommand?.join("");
    this.pythonServerPath = pathToPosix(context.asAbsolutePath(path.join("pythonServer", "server.py")));
    this.host = "127.0.0.1"; //vscode.workspace.getConfiguration("hamilton.sockets").get("host")
    this.port = 8080; //vscode.workspace.getConfiguration("hamilton.sockets").get("port")
  }
}
