import cytoscape from "cytoscape";
import dagre from 'cytoscape-dagre';

cytoscape.use( dagre );

var cy: cytoscape.Core

const vscode = acquireVsCodeApi();
window.addEventListener("load", main);

function main(){
  cy = cytoscape({
    container: document.getElementById('cy'),
    selectionType: 'single',
    elements: {
      nodes: [
        { data: { id: 'A' } },
        { data: { id: 'B' } },
        { data: { id: 'C' } },
        { data: { id: 'D' } },
        { data: { id: 'E' } },
        { data: { id: 'F' } },
        { data: { id: 'G' } },
        { data: { id: 'H' } },
        { data: { id: 'J' } },
        { data: { id: 'K' } },
        { data: { id: 'L' } },
        { data: { id: 'M' } }
      ],
      edges: [
        { data: { id: 'e1', source: 'A', target: 'B' } },
        { data: { id: 'e2', source: 'A', target: 'C' } },
        { data: { id: 'e3', source: 'B', target: 'D' } },
        { data: { id: 'e4', source: 'C', target: 'D' } },
        { data: { id: 'e5', source: 'C', target: 'E' } },
        { data: { id: 'e6', source: 'C', target: 'F' } },
        { data: { id: 'e7', source: 'D', target: 'G' } },
        { data: { id: 'e8', source: 'D', target: 'H' } },
        { data: { id: 'e9', source: 'E', target: 'H' } },
        { data: { id: 'e10', source: 'E', target: 'J' } },
        { data: { id: 'e11', source: 'F', target: 'J' } },
        { data: { id: 'e12', source: 'F', target: 'K' } },
        { data: { id: 'e13', source: 'G', target: 'L' } },
        { data: { id: 'e14', source: 'H', target: 'L' } },
        { data: { id: 'e15', source: 'H', target: 'M' } },
        { data: { id: 'e16', source: 'J', target: 'M' } }
      ]
    },
    layout: {
      name: 'dagre',
      directed: true,
      padding: 10,
      fit: true
    }
  });
  generate_cy_stylesheet(cy)
  cy.fit()
}

function generate_cy_stylesheet(cy: cytoscape.Core){
  cy.style().fromJson([
    {
      selector: 'node',
      style: {
        label: 'data(id)',
        'background-width': '90%',
        'background-height': '90%',
        width: '20',
        height: '20',
        'border-width': '0',
      },
    },
    {
      selector: ':selected',
      style: {
        'border-width': '4',
      },
    },
    {
      selector: 'edge',
      style: {
        'target-arrow-shape': 'triangle',
        'curve-style': 'bezier',
        width: 3,
      },
    },
  ]).update();
}  

window.addEventListener("message", (event) => {
  const message = event.data

  switch(message.command){
    case "updateElements":
      cy.remove("*")
      cy.add(message.data.elements)
      break;
  }

  cy.layout({
    name: 'dagre',
    nodeDimensionsIncludeLabels: true,
    spacingFactor: 1.5,
    animate: true,
  }).run()
});
