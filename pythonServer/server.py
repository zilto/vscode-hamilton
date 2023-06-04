import asyncio
import json
import logging
from threading import Event
from typing import Set

from hamilton import node
from hamilton.graph import FunctionGraph
from hamilton.driver import Driver
import websockets

from serialize import serialize_graph
from protocol import UnknownEventType, import_modules, load_inputs, select_nodes, ExecuteGraphConfig


# TODO pass native Python logging message to VSCode
# uncomment to debug websockets during development
# logger = logging.getLogger('websockets')
# logger.setLevel(logging.DEBUG)
# logger.addHandler(logging.StreamHandler())


CONNECTIONS = {}


async def error(websocket, message):
    """Route error message to sender client"""
    event = dict(
        command="error",
        details=message,
    )
    await websocket.send(json.dumps(event))


async def send_to_vscode(event):
    """Route response to vscode client"""
    try:
        websocket = CONNECTIONS["vscode"]
        await websocket.send(json.dumps(event))
    except:
        del CONNECTIONS["vscode"]
        raise ConnectionError("No client `vscode` registered")


async def send_to_lsp(event):
    """Route response to lsp client"""
    try:
        websocket = CONNECTIONS["lsp"]
        await websocket.send(json.dumps(event))
    except:
        del CONNECTIONS["lsp"]
        raise ConnectionError("No client `lsp` registered")


async def compile_dag(params) -> None:
    """Compile the hamilton graph without executing it"""
    modules = import_modules(params.module_file_paths)
    graph = FunctionGraph(*modules, config={})
    selected_nodes: Set[node.Node] = select_nodes(graph, params.downstream_nodes, params.upstream_nodes)
    json_graph = serialize_graph(selected_nodes)
    
    event = dict(
        command="compileDAG",
        details={"graph": json_graph}
    )
    await send_to_vscode(event)


async def execute_dag(params) -> None:
    """Compile the hamilton graph and execute it"""
    modules = import_modules(params.module_file_paths)
    driver = Driver({}, *modules)

    selected_nodes: Set[node.Node] = select_nodes(driver.graph, params.downstream_nodes, params.upstream_nodes)
    json_graph = serialize_graph(selected_nodes)

    inputs = load_inputs(params.config_path)
    outputs = [n.name for n in list(selected_nodes)]
    results = driver.execute(final_vars=outputs, inputs=inputs)

    event = dict(
        command="executeDAG",
        details={
            "graph": json_graph,
            "dataframe": results.to_html(),
        }
    )
    await send_to_vscode(event)


async def get_symbols(params) -> None:
    def type_to_string(type_):
        return f"{str(type_.__module__)}.{str(type_.__name__)}"

    modules = import_modules(params["module_file_paths"])
    graph = FunctionGraph(*modules, config={})

    nodes = []
    for node in graph.get_nodes():
        if len(node._tags) > 1:
            continue

        nodes.append(dict(
            label=node.name,
            documentation=node.documentation,
            type=type_to_string(node.type)
        ))

    event = dict(
        command="getSymbols",
        details={
            "nodes": nodes
        }
    )
    await send_to_lsp(event)


async def server_handler(websocket):
    """Handle """
    async for message in websocket:
        event = json.loads(message)
        command = event["command"]

        # logger.debug(f"Connected clients {list(CONNECTIONS.keys())}")
        try:  
            if command == "registerConnection":
                identity = event["details"]["identity"]
                CONNECTIONS[identity] = websocket

            elif command == "compileDAG":
                params = ExecuteGraphConfig(**event["details"])
                await compile_dag(params)

            elif command == "executeDAG":
                params = ExecuteGraphConfig(**event["details"])
                await execute_dag(params)

            elif command == "getSymbols":
                params = event["details"]
                await get_symbols(params)

            else:
                raise UnknownEventType
            
        except websockets.ConnectionClosedOK:
            break

        except Exception as e:
            await error(websocket, str(e))


class HamiltonExecutionServer:
    """Websockets server executing Hamilton Python code
    
    implementation inspired by pygls LSP server
    ref: https://github.com/openlawlibrary/pygls/blob/master/pygls/server.py
    """
    def __init__(self):
        self._server = None
        self._stop_event = None

        self.loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self.loop)

    def shutdown(self) -> None:
        self._stop_event.set()

        if self._server:
            self._server.close()
            self.loop.run_until_complete(self._server.wait_closed())

        if self.loop.is_closed:
            self.loop.close()

    def start_ws(self, host: str, port: int) -> None:
        self._stop_event = Event()
    
        start_server = websockets.serve(server_handler, host, port, loop=self.loop)
        self._server = start_server.ws_server
        self.loop.run_until_complete(start_server)

        try:
            self.loop.run_forever()
        except (KeyboardInterrupt, SystemExit):
            pass
        finally:
            self._stop_event.set()
            self.shutdown()


def main():
    server = HamiltonExecutionServer()
    server.start_ws(host="127.0.0.1", port=8080)


if __name__ == "__main__":
    main()
