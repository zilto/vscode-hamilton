# Hamilton server

Hamilton VSCode allows for interactive development features by running a Python websockets server in the background. The server loads the **registered modules** to compile and execute the Hamilton DAG.

Current features include:
- DAG visualization
- Dataframe preview

`Warning`: **Dataframe preview** will be slowdown by large data inputs and complex computations. Meanwhile, **DAG visualization** doesn't require computation.

## Debugging

You can view the server logs to inspect unexpected behaviors or bugs. The log level will match the `VSCode Log Level`. Set it to `Debug` for further details.

`Info`: If the server seems to get stuck, reload VSCode by opening the command palette `CTRL+P` and using `Developer: Reload Window`.

