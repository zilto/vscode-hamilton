import asyncio
from dataclasses import dataclass, field
import importlib
import json
import logging
from pathlib import Path
import sys
from typing import List, Set, Optional

try:
    from hamilton.graph import FunctionGraph
    from hamilton.driver import Driver
    from hamilton.data_quality.base import ValidationResult
    from hamilton import node
    import networkx
    import websockets
except ModuleNotFoundError as e:
    raise e

from protocol import UnknownEventType


# uncomment to debug websockets during development
# logger = logging.getLogger('websockets')
# logger.setLevel(logging.DEBUG)
# logger.addHandler(logging.StreamHandler())


@dataclass(frozen=True)
class ExecuteGraphConfig:
    module_file_paths: List[str]
    upstream_nodes: List[str] = field(default_factory=list)
    downstream_nodes: List[str] = field(default_factory=list)
    graph_config: dict = field(default_factory=dict)
    config_path: Optional[str] = None
    output_columns: List[str] = field(default_factory=list)


def _create_networkx_graph(
    nodes: Set[node.Node], user_nodes: Set[node.Node], name: str
) -> networkx.DiGraph:  # noqa: F821
    """Helper function to create a networkx graph.
    :param nodes: The set of computational nodes
    :param user_nodes: The set of nodes that the user is providing inputs for.
    :param name: The name to have on the graph.
    :return: a graphviz.Digraph; use this to render/save a graph representation.
    """

    def _node_representation(node) -> dict:
        base = dict(
            label=node.name,
            doc=node.documentation,
            type=node.type.__name__,
            module=node.tags.get("module", "user_defined"),  # want to make sure module is captured 
        )
        base.update(**node.tags)
        return base

    digraph = networkx.DiGraph(name=name)
    for n in nodes:
        digraph.add_node(n.name, **_node_representation(n))
    for n in user_nodes:
        digraph.add_node(n.name, **_node_representation(n))

    for n in list(nodes) + list(user_nodes):
        for d in n.dependencies:
            digraph.add_edge(d.name, n.name)
    return digraph


def import_modules(module_file_paths: List[str]):
    """Import requested modules to global var; if exists, reload it"""
    modules = []
    for file_path in set(module_file_paths):
        module_path = Path(file_path)
        module_name = module_path.stem
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


def serialize_graph(nodes: Set[node.Node], graph_name: str = "vscode-hamilton"):
    networkx_graph = _create_networkx_graph(nodes, set(), graph_name)
    cytoscape_json = networkx.cytoscape.cytoscape_data(networkx_graph)
    return cytoscape_json


def load_inputs(config_path: str) -> dict:
    import pandas as pd

    inputs = {}
    df = pd.read_json(config_path)
    for k, v in df.to_dict(orient="series").items():
        if k in inputs:
            raise KeyError("Duplicate keys in data sources in `load_inputs`")
        
        inputs[k] = v

    return inputs


async def server_handler(websocket):
    async for message in websocket:
        in_event = json.loads(message)

        command = in_event["command"]
        try:
            if command == "ping":
                out_event = dict(command="pong", details=None)
                
            elif command == "compileDAG":
                cfg = ExecuteGraphConfig(**in_event["details"])

                modules = import_modules(cfg.module_file_paths)
                graph = FunctionGraph(*modules, config={})
                selected_nodes: Set[node.Node] = select_nodes(graph, cfg.downstream_nodes, cfg.upstream_nodes)
                json_graph = serialize_graph(selected_nodes)

                out_event = dict(
                    command="compileDAG",
                    details={"graph": json_graph}
                )

            elif command == "executeDAG":
                cfg = ExecuteGraphConfig(**in_event["details"])

                modules = import_modules(cfg.module_file_paths)
                driver = Driver({}, *modules)

                selected_nodes: Set[node.Node] = select_nodes(driver.graph, cfg.downstream_nodes, cfg.upstream_nodes)
                json_graph = serialize_graph(selected_nodes)

                inputs = load_inputs(cfg.config_path)
                outputs = [n.name for n in list(selected_nodes)]
                results = driver.execute(final_vars=outputs, inputs=inputs)

                out_event = dict(
                    command="executeDAG",
                    details={
                        "graph": json_graph,
                        "dataframe": results.to_html(),
                    }
                )
                
            else:
                raise UnknownEventType

        except Exception as e:
            out_event = dict(
                command="error",
                details=str(e),
            )

        finally:
            await websocket.send(json.dumps(out_event))     


async def main():
    async with websockets.serve(server_handler, host="127.0.0.1", port=8080):
        await asyncio.Future()


if __name__ == "__main__":
    asyncio.run(main())
