
import { SocketCommand } from "../messages";

const vscode = acquireVsCodeApi();

window.addEventListener("load", () => {});

window.addEventListener("message", (event) => {
  const message = event.data;

  console.log("from script")
  switch (message.command) {
    case SocketCommand.getDataFrame:
      console.log("script switch")
      var element = document.getElementById("result")
      if (!element){
        return;
      }
      element.innerHTML = message.details
      console.log("message", message)
      break;
  }
});
