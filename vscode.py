import sys
import datetime
from pathlib import Path
from importlib import import_module

try:
    from hamilton import driver
except ModuleNotFoundError as e:
    print(f"{e}: Can't find module: sf-hamilton. Verify installation and VSCode workspace Python interpreter")


def main(cwd: str, module_filepaths: list[str]) -> None:
    modules = []
    for py_filepath in module_filepaths:
        module_name = Path(py_filepath).stem
        try:
            m = import_module(module_name)
            modules.append(m)
        except ModuleNotFoundError as e:
            print(f"{e}: Can't find module: {module_name}")


    driver_config = {}
    dr = driver.Driver(driver_config, *modules)

    render_config = {"format": "dot", "view": False, "cleanup": True}
    graphviz_config = {}

    dr.display_all_functions(Path(cwd).joinpath("hamilton_dag"), render_config, graphviz_config)

    print("HamiltonViz: DAG successfully built.")


if __name__ == "__main__":
    main(sys.path[0], sys.argv[1:])
