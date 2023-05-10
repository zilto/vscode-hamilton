import { codeStyles } from "../graph/stylesheet"
import { SocketCommand } from "../messages";

const vscode = acquireVsCodeApi();

window.addEventListener("load", () => {});

// dynamically set table style based on VSCode theme
function styleDataframe(dataframeElement: HTMLElement){
  let thead = dataframeElement.getElementsByTagName("thead")
  thead[0].style.backgroundColor = codeStyles["--vscode-editor-selectionHighlightBackground"]

  let rows = dataframeElement.getElementsByTagName("tr")
  console.log(rows)
  for (let i = 2; i < rows.length; i+=2){
    rows[i].style.backgroundColor = codeStyles["--vscode-editor-selectionBackground"]
  }
}

window.addEventListener("message", (event) => {
  const message = event.data;

  switch (message.command) {
    case SocketCommand.getDataFrame:
      var element = document.getElementById("result")
      if (!element){
        return;
      }
      element.innerHTML = message.details
      console.log(element)
      styleDataframe(element)
      break;
  }
});
