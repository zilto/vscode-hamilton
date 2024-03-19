export enum DataflowCommand {
  update,
  rotate,
  save,
}

export interface IMessage {
  command: DataflowCommand;
  details: any;
}
