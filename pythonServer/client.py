import json
from typing import Any, Optional

import asyncio
import websockets
from websockets.client import WebSocketClientProtocol



class HamiltonExecutionClient:
    def __init__(self):
        self._connection: Optional[WebSocketClientProtocol] = None

        self.loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self.loop)

    def connect(self):
        self.loop.run_until_complete(self._connect())

    def get_nodes(self, module_file_paths: list):
        return self.loop.run_until_complete(self._get_nodes(module_file_paths))

    async def _connect(self) -> None:
        self._connection = await websockets.connect("ws://127.0.0.1:8080/")
        await self._register_connection()

    async def _register_connection(self) -> None:
        if self._connection is None:
            return
        
        event = dict(
            command="registerConnection",
            details=dict(identity="lsp")
        )
        await self._connection.send(json.dumps(event))

    async def _get_nodes(self, module_file_paths: list) -> list:
        request = dict(
            command="getSymbols",
            details=dict(module_file_paths=module_file_paths)
        )
        await self._connection.send(json.dumps(request))
        response = await self._connection.recv()

        results = json.loads(response)
        return results["details"]["nodes"]


async def main():
    client = HamiltonExecutionClient()
    await client.connect()
    nodes = await client.get_nodes(["/home/tjean/projects/hamilton_demo/hello-world/my_functions.py"])
    print(nodes)


if __name__ == "__main__":
    asyncio.run(main())
    