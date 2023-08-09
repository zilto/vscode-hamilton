export enum DagCommand {
  build,
  update,
  rotate,
  save,
  expandAll,
  collapseAll,
  goToDefinition,
}

export enum DataframeCommand {
  update,
}

type SocketCommand = "buildDAG" | "executeDAG";
export const SocketCommand = {
  get buildDAG(): SocketCommand {
    return "buildDAG";
  },
  get executeDAG(): SocketCommand {
    return "executeDAG";
  },
};

export interface IMessage {
  command: DagCommand | SocketCommand | DataframeCommand;
  details: any;
}
