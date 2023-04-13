import sys
import os
from pathlib import Path
import importlib

try:
    from hamilton import driver
except ModuleNotFoundError as e:
    print(f"{e}: Can't find module: sf-hamilton. Verify installation and VSCode workspace Python interpreter")


def main(workspace_directory: str, module_filepaths: list[str]) -> None:
    os.chdir(workspace_directory)

    modules = []
    for py_filepath in module_filepaths: 
        try:
            module_path = Path(py_filepath)
            spec = importlib.util.spec_from_file_location(module_path.stem, module_path)
            module = spec.loader.load_module()
            modules.append(module)

        except ModuleNotFoundError as e:
            print(f"{e}: Can't find module: {module_path.stem}")

    print(modules)
    driver_config = {}
    dr = driver.Driver(driver_config, *modules)

    render_config = {"format": "dot", "view": False, "cleanup": True}
    graphviz_config = {}

    dr.display_all_functions(Path(workspace_directory).joinpath("hamilton_dag"), render_config, graphviz_config)

    print("HamiltonViz: DAG successfully built.")


if __name__ == "__main__":
    workspace_directory = sys.argv[1].lstrip("/")
    module_paths = sys.argv[2:]
    main(workspace_directory, module_paths)
