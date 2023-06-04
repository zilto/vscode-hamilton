from typing import Set

import networkx
from hamilton import node


def _node_representation(node) -> dict:
    base = dict(
        label=node.name,
        doc=node.documentation,
        type=node.type.__name__,
        module=node.tags.get("module", "user_defined"),  # want to make sure module is captured 
    )
    base.update(**node.tags)
    return base


def _create_networkx_graph(
    nodes: Set[node.Node], user_nodes: Set[node.Node], name: str
) -> networkx.DiGraph:  # noqa: F821
    """Helper function to create a networkx graph.
    :param nodes: The set of computational nodes
    :param user_nodes: The set of nodes that the user is providing inputs for.
    :param name: The name to have on the graph.
    :return: a graphviz.Digraph; use this to render/save a graph representation.
    """

    digraph = networkx.DiGraph(name=name)
    for n in nodes:
        digraph.add_node(n.name, **_node_representation(n))
    for n in user_nodes:
        digraph.add_node(n.name, **_node_representation(n))

    for n in list(nodes) + list(user_nodes):
        for d in n.dependencies:
            digraph.add_edge(d.name, n.name)
    return digraph



def serialize_graph(nodes: Set[node.Node], graph_name: str = "vscode-hamilton"):
    networkx_graph = _create_networkx_graph(nodes, set(), graph_name)
    cytoscape_json = networkx.cytoscape.cytoscape_data(networkx_graph)
    return cytoscape_json

