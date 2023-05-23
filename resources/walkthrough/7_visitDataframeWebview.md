# Dataframe preview [WIP]

The **Dataframe** view shows the results of executing the Hamilton driver. The extension will load the JSON file `{workspaceRoot}/.hamilton` (no extension), parse it, and use it as `inputs` argument for `hamilton.driver.execute()` [reference](https://hamilton.readthedocs.io/en/latest/reference/api-reference/drivers.html#hamilton.driver.Driver.execute). Typically, `.hamilton` will contain `key: value` pairs to access a file or a database (e.g., `{"db_path": "./data/database.duckdb"}`) via a [data loader](https://github.com/DAGWorks-Inc/hamilton/tree/main/examples/data_loaders). The output table will match your IDE color theme.


`Note`: this feature is WIP. Interactive tables and better inputs/outputs selection are planned.
