import cytoscape from "cytoscape";

export interface Message {
  command: "update" | "rotate" | "save";
  details: any;
}

export interface DagUpdateMessage extends Message {
  command: "update";
  details: {
    data: Array<string[]>;
    elements: cytoscape.ElementsDefinition;
    directed: boolean;
    multigraph: boolean;
  };
}

export interface DagRotateMessage extends Message {
  command: "rotate";
  details: void;
}

export interface DagSaveMessage extends Message {
  command: "save";
  details: {
    format: "svg" | "png";
    content?: any;
  };
}
