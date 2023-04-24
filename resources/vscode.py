from contextlib import redirect_stdout
from dataclasses import dataclass, field
import importlib
import json
from pathlib import Path
import io
import sys
from typing import List, Set

try:
    from hamilton.graph import FunctionGraph
    from hamilton import node
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


def _create_networkx_graph(
    nodes: Set[node.Node], user_nodes: Set[node.Node], name: str
) -> "networkx.DiGraph":  # noqa: F821
    """Helper function to create a networkx graph.
    :param nodes: The set of computational nodes
    :param user_nodes: The set of nodes that the user is providing inputs for.
    :param name: The name to have on the graph.
    :return: a graphviz.Digraph; use this to render/save a graph representation.
    """
    import networkx

    def _node_representation(node) -> dict:
        base = dict(
            label=node.name,
            doc=node.documentation,
            type=node.type.__name__,
            module=node.tags.get("module", "UD"),  # want to make sure module is captured 
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


def main(cfg: ScriptConfig) -> None:
    modules = []
    for py_file_path in cfg.module_file_paths: 
        try:
            module_path = Path(py_file_path)
            spec = importlib.util.spec_from_file_location(module_path.stem, module_path)
            module = spec.loader.load_module()
            modules.append(module)#
        except ModuleNotFoundError as e:
            raise e

    hamilton_graph = FunctionGraph(*modules, config={})

    requested_nodes = set()
    if config.downstream_nodes or config.upstream_nodes:
        requested_nodes.add(hamilton_graph.impacted_nodes(cfg.downstream_nodes))
        requested_nodes.add(hamilton_graph.impacted_nodes(cfg.upstream_nodes))
    else:
        requested_nodes = requested_nodes.union(set(hamilton_graph.get_nodes()))

    graph = _create_networkx_graph(requested_nodes, set(), "vscode-hamilton")
    graph_json_string = json.dumps(networkx.cytoscape_data(graph))

    padded_json_string = "#"*3 + graph_json_string + "#"*3
    return padded_json_string


if __name__ == "__main__":
    with redirect_stdout(io.StringIO()):
        config = load_config(sys.argv[1])
        padded_json_string = main(config)

    sys.stdout.write(padded_json_string)
