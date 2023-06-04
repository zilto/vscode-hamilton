from dataclasses import dataclass, field
import importlib
from pathlib import Path
import sys
from typing import List, Set, Optional

from hamilton import node


class UnknownEventType(Exception):
    "Raised when server event type is not registered"

@dataclass(frozen=True)
class ExecuteGraphConfig:
    module_file_paths: List[str]
    upstream_nodes: List[str] = field(default_factory=list)
    downstream_nodes: List[str] = field(default_factory=list)
    graph_config: dict = field(default_factory=dict)
    config_path: Optional[str] = None
    output_columns: List[str] = field(default_factory=list)


def import_modules(module_file_paths: List[str]):
    """Import requested modules to global var; if exists, reload it"""
    modules = []
    for file_path in set(module_file_paths):
        module_path = Path(file_path)
        if module_path.suffix == ".py":
            module_name = module_path.stem
        elif module_path.suffix == ".pyc":
            module_name = module_path.stem.split(".")[0]
        else:
            raise ValueError("Module file path should end with .py or .pyc")

        spec = importlib.util.spec_from_file_location(module_name, module_path)
        module = importlib.util.module_from_spec(spec)

        sys.modules[module_name] = module
        spec.loader.exec_module(module)
        modules.append(module)

    return modules


def select_nodes(graph, downstream_nodes: List[str], upstream_nodes: List[str]) -> Set[node.Node]:
    nodes = set()
    if downstream_nodes or upstream_nodes:
        nodes.add(graph.impacted_nodes(downstream_nodes))
        nodes.add(graph.impacted_nodes(upstream_nodes))
    else:
        nodes = nodes.union(set(graph.get_nodes()))
    
    return nodes


def load_inputs(config_path: str) -> dict:
    import pandas as pd

    inputs = {}
    df = pd.read_json(config_path)
    for k, v in df.to_dict(orient="series").items():
        if k in inputs:
            raise KeyError("Duplicate keys in data sources in `load_inputs`")
        
        inputs[k] = v

    return inputs
