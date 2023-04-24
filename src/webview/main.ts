import cytoscape from "cytoscape";
import dagre from "cytoscape-dagre";

cytoscape.use(dagre);

var cy: cytoscape.Core;
var layout = {
  name: "dagre",
  directed: true,
  rankDir: "LR",
  nodeDimensionsIncludeLabels: true,
  fit: true,
  animate: true,
  animationDuration: 250,
}

const stylesToGet = ["editorSelectionHighlightBackground", "editorSelectionBackground"];

// Convert the style string to an object of name/value pairs
const toStyleObject = (str: string) => {
  const data = str.split(":");
  let property = data[0];
  const value = data[1];

  property = property
    .replace("--vscode-", "")
    .split("-")
    .map((valuePart, idx) => {
      if (idx === 0) {
        return valuePart;
      }

      return `${valuePart.charAt(0).toUpperCase()}${valuePart.slice(1)}`;
    })
    .join("");

  return {
    [property]: value,
  };
};

const htmlStyle = document.querySelector("html")?.getAttribute("style");

const codeStyles = htmlStyle
  ?.split(";")
  .map((x) => x.trim())
  .filter((s) => s.startsWith("--vscode-"))
  .reduce((obj, current) => ({ ...obj, ...toStyleObject(current) }), {});
console.log(codeStyles);

const cyStylesheet: cytoscape.Stylesheet[] = [
  {
    selector: "node",
    style: {
      label: "data(id)",
      "text-valign": "center",
      "text-halign": "center",
      "background-width": "90%",
      "background-height": "90%",
      width: "30",
      height: "30",
      "border-width": "1px",
      "border-color": "black",
      "background-color": codeStyles["editorSelectionBackground"],
    },
  },
  {
    selector: "label",
    style: {
      color: codeStyles["editorSelectionHighlightBackground"],
      "text-outline-color": "black",
      "text-outline-width": "1px",
    },
  },
  {
    selector: ":selected",
    style: {
      "border-width": "2",
    },
  },
  {
    selector: "edge",
    style: {
      "target-arrow-shape": "triangle",
      "curve-style": "bezier",
      "background-color": "#C6C6C6",
      width: 3,
    },
  },
];

const vscode = acquireVsCodeApi();
window.addEventListener("load", main);

function main() {
  cy = cytoscape({
    container: document.getElementById("cy"),
    wheelSensitivity: 0.15,
    maxZoom: 5,
    minZoom: 0.2,
    elements: {
      nodes: [
        { data: { id: "A" } },
        { data: { id: "B" } },
        { data: { id: "C" } },
        { data: { id: "E" } },
        { data: { id: "F" } },
        { data: { id: "G" } },
        { data: { id: "H" } },
        { data: { id: "J" } },
        { data: { id: "K" } },
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
}

function bindCytoscapeEvents(cy: cytoscape.Core) {
  const fit = () => {
    cy.fit();
  };

  cy.on("dblclick", fit);
}

window.addEventListener("message", (event) => {
  const message = event.data;
  console.log("layout", cy.layout)

  switch (message.command) {
    case "updateElements":
      // when no module is selected, Python will respond with a properly formatted JSON with empty `nodes` and `edges` arrays
      if (message.details.elements.nodes.length === 0) {
        break;
      }

      cy.remove("*");
      cy.add(message.details.elements);

      cy.layout(layout).run();
      break

    case "rotate":
      if (layout.rankDir === "LR") {
        layout.rankDir = "TB"
      } else {
        layout.rankDir = "LR"
      }
      cy.layout(layout).run();

      break;
  }
});
