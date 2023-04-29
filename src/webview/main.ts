import cytoscape from "cytoscape";
import dagre from "cytoscape-dagre";
import svg from "cytoscape-svg";
import expandCollapse from "cytoscape-expand-collapse";
import undoRedo from "cytoscape-undo-redo";

interface CodeStyles {
  [name: string]: string;
}

function getCodeStyles(styles: string[]): CodeStyles {
  const htmlStyle = document.querySelector("html")?.getAttribute("style");
  if (!htmlStyle) {
    return {};
  }
  return htmlStyle
    ?.split(";")
    .map((str) => {
      const [key, val] = str.trim().split(":");
      return { key, val };
    })
    .filter((obj) => styles.includes(obj.key))
    .reduce((obj, current) => ({ ...obj, ...{ [current.key]: current.val } }), {});
}

const vscode = acquireVsCodeApi();

// load extensions
cytoscape.use(dagre);
cytoscape.use(svg);
undoRedo(cytoscape); // undoRedo is required by expandCollapse
expandCollapse(cytoscape);

// set global variables
var cy: cytoscape.Core;

var expandApi: any;

var layout = {
  name: "dagre",
  directed: true,
  nodeSep: 10,
  rankDir: "LR",
  nodeDimensionsIncludeLabels: true,
  fit: true,
  animate: true,
  animationDuration: 250,
};

const codeStyles = getCodeStyles([
  "--vscode-editor-selectionHighlightBackground",
  "--vscode-editor-selectionBackground",
  "--vscode-symbolIcon-classForeground",
]);

const cyStylesheet: cytoscape.Stylesheet[] = [
  {
    selector: "node",
    style: {
      label: "data(label)",
      color: codeStyles["--vscode-editor-selectionHighlightBackground"],
      "text-outline-color": "black",
      "text-outline-width": "1px",
      "text-valign": "center",
      "text-halign": "center",
      shape: "ellipse",
      width: "40",
      height: "40",
      "border-width": "1px",
      "border-color": "black",
      "background-color": codeStyles["--vscode-editor-selectionBackground"],
      visibility: "visible",
    },
  },
  {
    selector: "edge",
    style: {
      "target-arrow-color": "#cccccc",
      "line-color": "#cccccc",
      "target-arrow-shape": "triangle",
      "curve-style": "bezier",
      "background-color": "#C6C6C6",
      width: 3,
      visibility: "visible",
    },
  },
  {
    selector: "node.validator",
    style: {
      shape: "round-rectangle",
      width: "label",
      "border-width": 0,
    },
  },
  {
    selector: "edge.validator",
    style: {
      display: "none",
    },
  },
  {
    selector: "node.validated",
    style: {
      "border-color": codeStyles["--vscode-editor-selectionHighlightBackground"],
      "border-width": "4px",
      "border-opacity": 0.6,
    },
  },
  {
    selector: "node.module",
    style: {
      shape: "round-rectangle",
      width: "label",
      "text-valign": "top",
      "text-halign": "center",
      "background-color": codeStyles["--vscode-symbolIcon-classForeground"],
      "background-opacity": 0.3,
    },
  },
  {
    selector: "node.cy-expand-collapse-collapsed-node",
    style: {
      "text-valign": "center",
      "text-halign": "center",
      "padding-right": "4px",
      "padding-left": "4px",
    },
  },
  {
    selector: ":parent",
    style: {
      "text-valign": "top",
      "text-halign": "center",
      shape: "round-rectangle",
    },
  },
  {
    selector: "edge.highlight",
    style: {
      "target-arrow-color": codeStyles["--vscode-editor-selectionHighlightBackground"],
      "line-color": codeStyles["--vscode-editor-selectionHighlightBackground"],
      width: 5,
    },
  },
];

window.addEventListener("load", main);

function main() {
  cy = cytoscape({
    container: document.getElementById("cy"),
    wheelSensitivity: 0.15,
    maxZoom: 5,
    minZoom: 0.2,
    elements: {
      nodes: [
        { data: { id: "A", label: "A" } },
        { data: { id: "B", label: "B" } },
        { data: { id: "C", label: "C" } },
        { data: { id: "E", label: "E" } },
        { data: { id: "F", label: "F" } },
        { data: { id: "H", label: "H" } },
        { data: { id: "J", label: "J" } },
        { data: { id: "K", label: "K" } },
      ],
      edges: [
        { data: { id: "e1", source: "A", target: "B" } },
        { data: { id: "e2", source: "A", target: "C" } },
        { data: { id: "e5", source: "C", target: "E" } },
        { data: { id: "e6", source: "C", target: "F" } },
        { data: { id: "e9", source: "E", target: "H" } },
        { data: { id: "e10", source: "E", target: "J" } },
        { data: { id: "e11", source: "F", target: "J" } },
        { data: { id: "e12", source: "F", target: "K" } },
      ],
    },
    style: cyStylesheet,
    layout: layout,
    boxSelectionEnabled: false,
  });
  cy.fit();
  bindCytoscapeEvents(cy);

  expandApi = cy.expandCollapse({
    layoutBy: layout,
    animationDuration: 250,
    fit: true,
  });
}

function bindCytoscapeEvents(cy: cytoscape.Core) {
  cy.on("dblclick", () => cy.fit());
  cy.on("resize", () => cy.fit());
  cy.on("select", (event) => {
    cy.elements().removeClass("highlight");
    event.target.predecessors().addClass("highlight");
    event.target.successors().addClass("highlight");
  });
  cy.on("unselect", () => cy.elements().removeClass("highlight"));
  cy.nodes().on("expandcollapse.beforecollapse", (event) => expandApi.collapse(event.target.children()));
  cy.nodes().on("expandcollapse.afterexpand", (event) => expandApi.expand(event.target.children()));
}

// TODO add batching
function handleUpdate(message: any) {
  // when no module is selected, Python will respond with a properly formatted JSON with empty `nodes` and `edges` arrays
  if (message.details.elements.nodes.length === 0) {
    return;
  }

  const moduleSet: Set<string> = new Set(
    message.details.elements.nodes.map((node: cytoscape.NodeDataDefinition) => node.data.module),
  );
  const transformNodes = message.details.elements.nodes.filter(
    (node: cytoscape.NodeDataDefinition, i: number, nodes: cytoscape.NodeDataDefinition[]) =>
      node.data.type !== "ValidationResult" && !node.data.id.endsWith("_raw"),
  );

  cy.remove("*");
  cy.add(message.details.elements);

  moduleSet.forEach((m: string) => {
    cy.add({ group: "nodes", classes: "module", data: { id: m, name: m, label: "Module: " + m } });
    cy.$('node[module ="' + m + '"]').move({ parent: m });
  });

  transformNodes.forEach((target: cytoscape.NodeDataDefinition) => {
    let rawNode = cy.$('node[id ="' + target.data.id.concat("_raw") + '"]');
    if (rawNode) {
      rawNode
        .incomers()
        .nodes()
        .forEach((incomer) => cy.add({ data: { source: incomer.id(), target: target.data.id } }));
      cy.remove(rawNode);
    }
  });

  cy.nodes("node[type = 'ValidationResult']").forEach((ele) => {
    ele.move({ parent: ele.data("hamilton.data_quality.source_node") });
    ele.addClass("validator").connectedEdges().addClass("validator");
    ele.nodes().parent().addClass("validated");
  });

  expandApi.collapse(cy.$("node.validated"));
}

function handleRotate(message: any) {
  if (layout.rankDir === "LR") {
    layout.rankDir = "TB";
  } else {
    layout.rankDir = "LR";
  }
  cy.layout(layout).run();
}

function handleSave(message: any) {
  let content;
  switch (message.details.format) {
    case "svg":
      content = cy.svg();
  }
  vscode.postMessage({
    command: "save",
    details: { content: content, format: message.details.format },
  });
}

function handleExpandAll(message: any) {
  expandApi.expandAll();
}

function handleCollapseAll(message: any) {
  expandApi.collapseAll();
}

window.addEventListener("message", (event) => {
  const message = event.data;

  switch (message.command) {
    case "update":
      handleUpdate(message);
      break;

    case "rotate":
      handleRotate(message);
      break;

    case "save":
      handleSave(message);
      break;

    case "expandAll":
      handleExpandAll(message);
      break;

    case "collapseAll":
      handleCollapseAll(message);
      break;
  }
});
