import cytoscape from "cytoscape";

export interface IMessage {
  command: string;
  details: any;
}

export interface DagUpdateMessage extends IMessage {
  command: "update";
  details: {
    data: Array<string[]>;
    elements: cytoscape.ElementsDefinition;
    directed: boolean;
    multigraph: boolean;
  };
}

export interface DagRotateMessage extends IMessage {
  command: "rotate";
  details: void;
}

export interface DagSaveMessage extends IMessage {
  command: "save";
  details: {
    format: "svg" | "png";
    content?: any;
  };
}
