from dataclasses import dataclass, field
import importlib
import json
from pathlib import Path
import sys
from typing import List

try:
    from hamilton.graph import FunctionGraph, create_networkx_graph
    import networkx
except ModuleNotFoundError as e:
    raise e


@dataclass(frozen=True)
class ScriptConfig:
    module_file_paths: List[str]
    upstream_nodes: field(default_factory=list)
    downstream_nodes: field(default_factory=list)


def load_config(json_string) -> ScriptConfig:
    return ScriptConfig(**json.loads(json_string))


def main(cfg: ScriptConfig) -> None:
    modules = []
    for py_file_path in cfg.module_file_paths: 
        try:
            module_path = Path(py_file_path)
            spec = importlib.util.spec_from_file_location(module_path.stem, module_path)
            module = spec.loader.load_module()
            modules.append(module)

        except ModuleNotFoundError as e:
            print(f"{e}: Can't find module: {module_path.stem}")

    hamilton_graph = FunctionGraph(*modules, config={})

    requested_nodes = set()
    if config.downstream_nodes or config.upstream_nodes:
        requested_nodes.add(hamilton_graph.impacted_nodes(cfg.downstream_nodes))
        requested_nodes.add(hamilton_graph.impacted_nodes(cfg.upstream_nodes))
    else:
        requested_nodes = requested_nodes.union(set(hamilton_graph.get_nodes()))

    graph = create_networkx_graph(requested_nodes, set(), "vscode-hamilton")
    graph_json_dict: dict = networkx.cytoscape_data(graph)

    print(json.dumps(graph_json_dict))


if __name__ == "__main__":
    config = load_config(sys.argv[1])
    main(config)
