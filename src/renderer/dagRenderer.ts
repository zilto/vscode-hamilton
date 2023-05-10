import type { OutputItem } from 'vscode-notebook-renderer';
import * as graph from "../graph";

export function activate() {
  return {
    renderOutputItem(outputItem: OutputItem, element: HTMLElement) {	
      element.id = "cy"
      element.style.width = "100%"
      element.style.height = "400px"
      graph.init()
      graph.update(outputItem.json())
    },
    disposeOutputItem() {
    }
  };
}
