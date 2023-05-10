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
  collapseAll
}

type SocketCommand = "executeGraph" | "getDataFrame"
export const SocketCommand = {
  get executeGraph(): SocketCommand {return "executeGraph"},
  get getDataFrame(): SocketCommand {return "getDataFrame"},
}

export interface IMessage {
  command: DagCommand | SocketCommand;
  details: any;
}
