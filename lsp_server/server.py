import re
from typing import Optional

import attrs
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
    VersionedTextDocumentIdentifier,
)
from pygls.server import LanguageServer

from lsp_server import __version__

from hamilton import ad_hoc_utils
from hamilton.graph_types import HamiltonGraph
from hamilton.graph import FunctionGraph, create_graphviz_graph


def _type_to_string(type_):
    """Return the full path of type, but may not be accessible from document
    For example, `pandas.core.series.Series` while document defines `pandas as pd`
    """
    return f"{str(type_.__module__)}.{str(type_.__name__)}"


def _parse_function_tokens(document) -> dict:
     # re.DOTALL allows for multiline definition
    FUNCTION_PATTERN = re.compile(r"def\s+(\w+)\((.*?)\)\s*->\s*([^\n:]+)", re.DOTALL) 

    # {function_name: type}
    results = {}
    for line in document.lines:
        for matching in FUNCTION_PATTERN.finditer(line):
            function_name = matching.group(1)
            return_type = matching.group(3)
            results[function_name] = return_type

            argument_string = matching.group(2)
            for arg_with_type in argument_string.split(","):
                arg_with_type = arg_with_type.strip()
                arg, arg_type = arg_with_type.split(":")
                results[arg.strip()] = arg_type.strip()
    
    return results


class HamiltonLanguageServer(LanguageServer):
    """Hamilton language server implementing LSP

    Class attributes are automatically registered on the client side
    i.e., completes client/registerCapability;
    ref: https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#client_registerCapability
    """
    CMD_VIEW_REQUEST = "lsp-view-request"
    CMD_VIEW_RESPONSE = "lsp-view-response"

    def __init__(self, *args):
        super().__init__("HamiltonServer", __version__, max_workers=2)

        self.active_uri: Optional[str] = None
        self.orientation = "LR"
        self.fgraph = FunctionGraph({}, {})
        self.completion_cache = []


LSP_SERVER = HamiltonLanguageServer()


@LSP_SERVER.feature(TEXT_DOCUMENT_DID_CHANGE)
def did_change(server: HamiltonLanguageServer, params: DidChangeTextDocumentParams):
    """try to build the dataflow and cache it on the server by creating
    a temporary module from the document's source code
    """
    uri = params.text_document.uri
    document = server.workspace.get_document(uri)
    
    server.active_uri = uri

    try:
        module = ad_hoc_utils.module_from_source(document.source)
        server.fgraph = FunctionGraph.from_modules(module, config={})
    except:
        return
    
    hamilton_view(server, [{}])


@LSP_SERVER.feature(TEXT_DOCUMENT_DID_OPEN)
def did_open(server: HamiltonLanguageServer, params: DidOpenTextDocumentParams):
    """trigger the did_change() event"""
    did_change(server, DidChangeTextDocumentParams(
        text_document=VersionedTextDocumentIdentifier(version=0, uri=params.text_document.uri),
        content_changes=[],
    ))


@LSP_SERVER.feature(TEXT_DOCUMENT_COMPLETION, CompletionOptions(trigger_characters=["(", ","]))
def on_completion(server: HamiltonLanguageServer, params: CompletionParams) -> CompletionList:
    """Return completion items based on the cached dataflow nodes name and type."""
    uri = params.text_document.uri
    document = server.workspace.get_document(uri)
    
    hgraph = HamiltonGraph.from_graph(server.fgraph)
    tokens = _parse_function_tokens(document)
    items = []
    for node in hgraph.nodes:
        if len(node.tags) > 1:
            continue
        
        # prefer the parsed tokens since they respect the module imports
        type_: str = tokens.get(node.name, _type_to_string(node.type))
        items.append(
            CompletionItem(
                label=node.name,
                label_details=CompletionItemLabelDetails(
                    detail=f" {type_}",
                    description="Node",
                ),
                kind=CompletionItemKind(3),  # 3 is the enum for `Function` kind
                documentation=node.documentation,
                insert_text=f"{node.name}: {type_}"
            )
        )
        
    return CompletionList(is_incomplete=True, items=items)


# use attrs library since lsprotocol uses it
@attrs.define
class CmdViewParams:
    rotate: Optional[bool] = False


@LSP_SERVER.thread()
@LSP_SERVER.command(HamiltonLanguageServer.CMD_VIEW_REQUEST)
def hamilton_view(server: HamiltonLanguageServer, args: list):
    """View the cached dataflow and send the graphviz string to the extension host."""
    params = CmdViewParams(**args[0])
    
    if params.rotate:
        if server.orientation == "LR":
            server.orientation = "TB"
        elif server.orientation == "TB":
            server.orientation = "LR"
        else:
            raise ValueError("`orientation` is neither TB or LR")

    dot = create_graphviz_graph(
        nodes=set(server.fgraph.get_nodes()),
        comment="vscode-dataflow",
        node_modifiers=dict(),
        strictly_display_only_nodes_passed_in=True,
        graphviz_kwargs=dict(
            graph_attr=dict(bgcolor="transparent"),
            edge_attr=dict(color="white"),
        ),
        orient=server.orientation
    )
   
    server.send_notification(
        HamiltonLanguageServer.CMD_VIEW_RESPONSE,
        dict(uri=server.active_uri, dot=dot.source)
    )


def start():
    LSP_SERVER.start_io()
