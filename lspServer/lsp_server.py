import py_compile
import re

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
    Diagnostic,
    DidChangeTextDocumentParams,
    DidOpenTextDocumentParams,
    MessageType,
    Position,
    Range,
)
from pygls.uris import to_fs_path
from pygls.server import LanguageServer


class HamiltonLanguageServer(LanguageServer):
    """Hamilton language server implementing LSP

    Class attributes are automatically registered on the client side
    i.e., completes client/registerCapability;
    ref: https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#client_registerCapability
    """
    CMD_COMPILE_DOCUMENT = "compileDocument"
    CMD_REGISTER_COMPLETIONS = "registerCompletions"
    CMD_UNREGISTER_COMPLETIONS = "unregisterCompletions"

    def __init__(self, *args):
        super().__init__(*args)

        self.TOKEN_CACHE = {}
        self.NODE_CACHE = {}


def _get_functions_static(document) -> dict:
    FUNCTION_PATTERN = re.compile(r"def\s+(\w+)\((.*?)\)\s*->\s*([^\n:]+)", re.DOTALL)  # re.DOTALL allows for multiline definition

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


def _compile_document(server: HamiltonLanguageServer, uri) -> str:
    pyc_path = ""
    diagnostics = []

    try:
        pyc_path = py_compile.compile(file=to_fs_path(uri))
    except SyntaxError as err:
        d = Diagnostic(
            range=Range(
                start=Position(line=err.lineno-1, character=err.offset - 1),
                end=Position(line=err.end_lineno-1, character=err.end_offset-1)
            )
        )

        diagnostics.append(d)

    server.publish_diagnostics(uri, diagnostics)

    return pyc_path


def _execute(module_file_paths):
    import importlib
    from pathlib import Path
    import sys
    from hamilton.graph import FunctionGraph

    def import_modules(module_file_paths: list):
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
    
    def type_to_string(type_):
        return f"{str(type_.__module__)}.{str(type_.__name__)}"

    modules = import_modules(module_file_paths)
    graph = FunctionGraph(*modules, config={})

    nodes = {}
    for node in graph.get_nodes():
        if len(node._tags) > 1:
            continue

        nodes[node.name] = dict(
            label=node.name,
            documentation=node.documentation,
            type=type_to_string(node.type)
        )

    return nodes

hamilton_lsp_server = HamiltonLanguageServer("HamiltonServer", "0.1.0")

@hamilton_lsp_server.feature(TEXT_DOCUMENT_DID_CHANGE)
def did_change(server: HamiltonLanguageServer, params: DidChangeTextDocumentParams):
    uri = params.text_document.uri
    document = server.workspace.get_document(uri)

    if (pyc_path := _compile_document(server, uri)):
        nodes = _execute([pyc_path])
        server.NODE_CACHE.update(nodes)

    results = _get_functions_static(document)
    server.TOKEN_CACHE.update(results)

@hamilton_lsp_server.feature(TEXT_DOCUMENT_DID_OPEN)
async def did_open(server: HamiltonLanguageServer, params: DidOpenTextDocumentParams):
    server.send_notification("$/test", "notification_message")
    uri = params.text_document.uri
    document = server.workspace.get_document(uri)

    if (pyc_path := _compile_document(server, uri)):
        try:
            nodes = _execute([pyc_path])
            server.NODE_CACHE.update(nodes)
        except:
            pass


    results = _get_functions_static(document)
    server.TOKEN_CACHE.update(results)

@hamilton_lsp_server.feature(TEXT_DOCUMENT_COMPLETION, CompletionOptions(trigger_characters=["(", ","]))
def on_completion(server: HamiltonLanguageServer, params: CompletionParams) -> CompletionList:
    items = []
    for node in server.NODE_CACHE.values():
        item = CompletionItem(
            label=node["label"],
            label_details=CompletionItemLabelDetails(
                detail=" " + server.TOKEN_CACHE.get(node["label"], node["type"]),
                description="Hamilton"
            ),
            kind=CompletionItemKind(3),  # 3 is the enum for `Function` kind
            documentation=node["documentation"],
            insert_text=f"{node['label']}: {server.TOKEN_CACHE.get(node['label'], node['type'])}",
        ) 
        items.append(item)

    return CompletionList(
        is_incomplete=True,
        items=items,
    )

@hamilton_lsp_server.command(HamiltonLanguageServer.CMD_COMPILE_DOCUMENT)
def hamilton_execution(server: HamiltonLanguageServer, *args):
    server.show_message_log("command ran")
    pass
    # uri = args[0][0]
    # document = server.workspace.get_document(uri)

    # results = _get_functions_static(document)
    # server.TOKEN_CACHE.update(results)

    # server.show_message_log()
