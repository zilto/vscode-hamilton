from pathlib import Path
import re
import sys
from types import ModuleType
from typing import Optional, List, Set, Mapping

from lsprotocol.types import (
    TEXT_DOCUMENT_COMPLETION,
    TEXT_DOCUMENT_DID_CHANGE,
    TEXT_DOCUMENT_DID_OPEN,
)
from lsprotocol.types import (
    CompletionItem,
    CompletionItemKind,
    CompletionItemLabelDetails,
    CompletionList,
    CompletionOptions,
    CompletionParams,
    DidChangeTextDocumentParams,
    DidOpenTextDocumentParams,
    VersionedTextDocumentIdentifier
)
from pygls.uris import to_fs_path
from pygls.server import LanguageServer

import networkx
from hamilton.node import Node
from hamilton.graph import FunctionGraph


def _node_representation(node) -> dict:
    base = dict(
        label=node.name,
        doc=node.documentation,
        type=node.type.__name__,
        module=node.tags.get("module", "user_defined"),  # want to make sure module is captured 
    )
    base.update(**node.tags)
    return base


def create_networkx_graph(
    nodes: Set[Node], user_nodes: Set[Node] = set(), name: str = "vscode-hamilton"
) -> networkx.DiGraph:
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


def nx_topology_change(graph1: networkx.DiGraph, graph2: networkx.DiGraph) -> bool:
    """Return True if changes to edges or nodes"""
    return not networkx.utils.edges_equal(graph1.edges, graph2.edges) & networkx.utils.nodes_equal(graph1.nodes, graph2.nodes)


def nx_attribute_only_change(graph1: networkx.DiGraph, graph2: networkx.DiGraph) -> bool:
    """Return True if changes to topology is False, but changes to graph is True"""
    if nx_topology_change(graph1, graph2):
       return False
    
    return networkx.utils.graphs_equal(graph1, graph2)


def serialize_graph(nodes: Set[Node], graph_name: str = "vscode-hamilton"):
    nx_graph = create_networkx_graph(nodes, set(), graph_name)
    cytoscape_json = networkx.cytoscape.cytoscape_data(nx_graph)
    return cytoscape_json


def parse_function_tokens(document) -> dict:
     # re.DOTALL allows for multiline definition
    FUNCTION_PATTERN = re.compile(r"def\s+(\w+)\((.*?)\)\s*->\s*([^\n:]+)", re.DOTALL) 

    # {function_name: type}
    results = {}
    for line in document.lines:
        for match in FUNCTION_PATTERN.finditer(line):
            function_name = match.group(1)
            return_type = match.group(3)
            results[function_name] = return_type

            argument_string = match.group(2)
            for arg_with_type in argument_string.split(","):
                arg_with_type = arg_with_type.strip()
                arg, arg_type = arg_with_type.split(":")
                results[arg.strip()] = arg_type.strip()
    
    return results


def _import_temp_module(module_path: str, docstring: Optional[str] = None) -> ModuleType:
    """Reads file at module_path as text; Register a temporary module via sys.modules
    Bind the source code from module_path to the temporary module using `exec()`
    """
    with open(module_path, "r") as f:
        source = f.read()

    module_name = str(Path(module_path).stem)
    module_object = ModuleType(module_name, docstring)
    sys.modules[module_name] = module_object
    exec(source, module_object.__dict__)

    return module_object


def import_modules(module_file_paths: List[str]) -> List[ModuleType]:
    modules = []
    for module_path in module_file_paths:
        try:
            module = _import_temp_module(module_path)
            modules.append(module)
        except SyntaxError:
            pass
    return modules


def build_dag(module_file_paths: List[str]) -> FunctionGraph:
    if (modules := import_modules(module_file_paths)):
        return FunctionGraph(*modules, config={})


def _type_to_string(type_):
    """Return the full path of type, but may not be accessible from document
    For example, `pandas.core.series.Series` while document defines `pandas as pd`
    """
    return f"{str(type_.__module__)}.{str(type_.__name__)}"


def get_completion_items(graph: FunctionGraph, document) -> List[CompletionItem]:
    """Iterate over Hamilton DAG nodes; Create Completion Item for each using 
    either the type from parsed regex or runtime inspection
    """
    tokens = parse_function_tokens(document)

    items = []
    for node in graph.get_nodes():
        if len(node._tags) > 1:
            continue

        # prefer the parsed tokens since they respect the module imports
        type_: str = tokens.get(node.name, _type_to_string(node.type))

        item = CompletionItem(
            label=node.name,
            label_details=CompletionItemLabelDetails(
                detail=" " + type_,
                description="Hamilton"
            ),
            kind=CompletionItemKind(3),  # 3 is the enum for `Function` kind
            documentation=node.documentation,
            insert_text=f"{node.name}: {type_}",
        ) 
        items.append(item)
    
    return items


def graph_to_json(graph: FunctionGraph) -> Mapping:
    nodes = graph.get_nodes()
    nx_graph = create_networkx_graph(set(nodes), set(), "vscode-hamilton")
    graph_json = networkx.cytoscape.cytoscape_data(nx_graph)
    return graph_json
    

class HamiltonLanguageServer(LanguageServer):
    """Hamilton language server implementing LSP

    Class attributes are automatically registered on the client side
    i.e., completes client/registerCapability;
    ref: https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#client_registerCapability
    """
    CMD_SHOW_DAG = "lsp/showDAG"

    def __init__(self, *args):
        super().__init__(*args)

        self.GRAPH_CACHE = FunctionGraph(config={})
        self.COMPLETION_CACHE = []


LSP_SERVER = HamiltonLanguageServer("HamiltonServer", "0.1.0")


@LSP_SERVER.feature(TEXT_DOCUMENT_DID_CHANGE)
def did_change(server: HamiltonLanguageServer, params: DidChangeTextDocumentParams):
    """On file change: try to import the current file as a temporary module, generate
    the Hamilton DAG, and cache it in memory. Then, use the cached graph to generate
    and cache completion items for future `on_completion()` LSP events 
    """
    uri = params.text_document.uri
    document = server.workspace.get_document(uri)

    modules = import_modules([to_fs_path(uri)])
    if not modules:
        return

    previous_graph = server.GRAPH_CACHE
    server.GRAPH_CACHE = FunctionGraph(*modules, config={})
    server.COMPLETION_CACHE = get_completion_items(server.GRAPH_CACHE, document)

    # checks for a diff in the DAG structure; if true: send LSP to update DAG view in IDE
    previous_graph_nx = create_networkx_graph(set(previous_graph.get_nodes()))
    current_graph_nx = create_networkx_graph(set(server.GRAPH_CACHE.get_nodes()))
    if nx_topology_change(previous_graph_nx, current_graph_nx):
        graph_json = graph_to_json(server.GRAPH_CACHE)
        server.send_notification("lsp/showDAG", graph_json)


@LSP_SERVER.feature(TEXT_DOCUMENT_DID_OPEN)
def did_open(server: HamiltonLanguageServer, params: DidOpenTextDocumentParams):
    """did_open follows the logic of did_change"""
    did_change(server, DidChangeTextDocumentParams(
        text_document=VersionedTextDocumentIdentifier(version=0, uri=params.text_document.uri),
        content_changes=[],
    ))


@LSP_SERVER.feature(TEXT_DOCUMENT_COMPLETION, CompletionOptions(trigger_characters=["(", ","]))
def on_completion(server: HamiltonLanguageServer, params: CompletionParams) -> CompletionList:
    """Return the cached list of completion items computed by `did_change()` LSP events"""
    return CompletionList(
        is_incomplete=True,
        items=server.COMPLETION_CACHE,
    )


@LSP_SERVER.command(HamiltonLanguageServer.CMD_SHOW_DAG)
def hamilton_show_dag(server: HamiltonLanguageServer, *args):
    """Return JSON representation of the GRAPH_CACHE
    The client should call `lsp/buildDAG` then `lsp/showDAG` to update the client-side visualization
    """

    module_file_paths = args[0][0]
    if len(module_file_paths) < 1 | any((not isinstance(p, str) for p in module_file_paths)):
        return
    
    if isinstance(module_file_paths, str):
        module_file_paths = [module_file_paths]

    modules = import_modules(module_file_paths)
    graph = FunctionGraph(*modules, config={})
    graph_json = graph_to_json(graph)
    
    server.send_notification("lsp/showDAG", graph_json)


def start():
    LSP_SERVER.start_io()

    