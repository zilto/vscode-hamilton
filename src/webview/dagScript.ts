import cytoscape = require("cytoscape");
import * as graph from "../graph";
import { DagCommand } from "../messages";

// TODO add state caching when hiding webview
// ref: https://code.visualstudio.com/api/extension-guides/webview#persistence
const vscode = acquireVsCodeApi();

function saveCyState(cy: cytoscape.Core){
  const cyState = cy.json()
  console.log("setState", cyState)
  vscode.setState({ cyState })
}

function loadCyState(cy: cytoscape.Core){
  const previousState = vscode.getState();
  if (previousState) {
    let previousCy = previousState.cyState
    console.log("getState", previousCy)

    cy.json(previousCy)
  }
}

window.addEventListener("load", () => {
    graph.init();
    graph.cy.on("cxttap", "node", (event) => {
      vscode.postMessage({
        command: DagCommand.goToDefinition,
        details: {
          name: event.target.data("name"),
          module: event.target.data("module")
        }
      })
    });
    // loadCyState(graph.cy)
  }
);

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
        command: DagCommand.save,
        details: { 
          content: content,
          format: message.details.format
        },
      });
      break;

    case DagCommand.expandAll:
      graph.expandAll();
      break;

    case DagCommand.collapseAll:
      graph.collapseAll();
      break;
  }

  // saveCyState(graph.cy)
});
