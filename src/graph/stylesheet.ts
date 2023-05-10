interface CodeStyles {
  [name: string]: string;
}

// get colors from the activate VSCode theme
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

const codeStyles = getCodeStyles([
  "--vscode-editor-selectionHighlightBackground",
  "--vscode-editor-selectionBackground",
  "--vscode-symbolIcon-classForeground",
]);

export const cyStylesheet: cytoscape.Stylesheet[] = [
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
      label: (element) => element.data("label").split(element.data("parent") + "_")[1],
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
      label: (element) => "Module: " + element.data("label"),
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