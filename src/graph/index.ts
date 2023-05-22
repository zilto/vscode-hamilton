import cytoscape from "cytoscape";
import dagre from "cytoscape-dagre";
import svg from "cytoscape-svg";
import expandCollapse from "cytoscape-expand-collapse";
import undoRedo from "cytoscape-undo-redo";

import { layout } from "./layout";
import { cyStylesheet } from "./stylesheet";

// load extensions
cytoscape.use(dagre);
cytoscape.use(svg);
undoRedo(cytoscape); // undoRedo is required by expandCollapse
expandCollapse(cytoscape);

var expandApi: any;

var cy: cytoscape.Core;

export function init() {
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
export function update(message: any) {
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
    cy.add({ group: "nodes", classes: "module", data: { id: m, name: m, label: m } });
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

export function rotate() {
  if (layout.rankDir === "LR") {
    layout.rankDir = "TB";
  } else {
    layout.rankDir = "LR";
  }
  cy.layout(layout).run();
}

export function expandAll() {
  expandApi.expandAll();
}

export function collapseAll() {
  expandApi.collapseAll();
}

export function save(format: string): any {
  let content;
  switch (format) {
    case "svg":
      content = cy.svg();
  }
  return content;
}
