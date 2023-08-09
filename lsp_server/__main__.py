import argparse
import logging

logger = logging.getLogger('pygls')
logger.setLevel(logging.DEBUG)
logger.addHandler(logging.StreamHandler())


def main():
    from lsp_server import server

    parser = argparse.ArgumentParser(prog="hamilton-lsp")
    parser.description = "Hamilton LSP server launcher"

    parser.add_argument(
        "--host", default="127.0.0.1", help="Bind to this address"
    )

    parser.add_argument(
        "--port", type=int, default=2087, help="Bind to this port"
    )

    parser.parse_args()

    server.start()

if __name__ == "__main__":
    main()
