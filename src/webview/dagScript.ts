import * as graph from "../graph";
import { DagCommand } from "../messages";

// TODO add state caching when hiding webview
const vscode = acquireVsCodeApi();

window.addEventListener("load", graph.init);

window.addEventListener("message", (event) => {
  const message = event.data;

  switch (message.command) {
    case DagCommand.update:
      graph.update(message);
      break;

    case DagCommand.rotate:
      graph.rotate();
      break;

    case DagCommand.save:
      const content = graph.save(message.details.format);
      // postMessage exits the webview context and accesses the extension host
      vscode.postMessage({
        command: "save",
        details: { content: content, format: message.details.format },
      });
      break;

    case DagCommand.expandAll:
      graph.expandAll();
      break;

    case DagCommand.collapseAll:
      graph.collapseAll();
      break;
  }
});
