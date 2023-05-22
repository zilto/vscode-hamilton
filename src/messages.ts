export enum MessageKind {
  clientNotifiedServer,
  serverNotifiedClient,
  serverRequested,
  clientRequested,
  resultForClient,
  responseForServer,
}

export enum DagCommand {
  build,
  update,
  rotate,
  save,
  expandAll,
  collapseAll,
}

export enum DataframeCommand {
  update,
}

type SocketCommand = "compileDAG" | "executeDAG";
export const SocketCommand = {
  get compileDAG(): SocketCommand {
    return "compileDAG";
  },
  get executeDAG(): SocketCommand {
    return "executeDAG";
  },
};

export interface IMessage {
  command: DagCommand | SocketCommand | DataframeCommand;
  details: any;
}
