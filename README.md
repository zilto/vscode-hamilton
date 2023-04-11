# Hamilton - VSCode extension (unofficial)

## Features
- Sidebar tree view UI:
  - Nested Python modules => Python functions (ignore names with underscore prefix)
  - Icons for modules and functions
  - Click item to open in editor tab
  - Tree view auto-refreshes on file updates
  - Buttons to execute "Refresh", "Select", and "Build DAG" commands
- Commands:
  - Manually refresh Tree view (shouldn't be needed)
  - Select Python modules
  - Build full DAG and output visualization for selected Python modules
- Cache:
  - Caches Python module selection to workspace for future command call
- Workspace:
  - Automatically uses Python interpreter selected for the workspace
- Added `hamilton.experimental.vscode` script to `Hamilton` to build DAG


## Installation
- Download the `hamilton-0.0.1.vsix`
- Go to the terminal and move to the `.vsix` file location
- Run the command `code --install-extension hamilton-0.0.1.vsix`
- Copy the file `vscode.py` to the `/hamilton/experimental/` folder of your Python environment
[More details](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)

## TODO
- Implement vscode.TaskProvider or shell child processes to call Hamilton and handle output
- Pass Hamilton execution and visualization configuration  from VSCode
- Allow to select individual functions from module to build graph
- Provide language support to write Hamilton Python functions