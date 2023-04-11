import * as vscode from 'vscode';


export interface ModuleItem {
	label: string,
	uri: vscode.Uri,
	picked: boolean,
}


export interface CacheState {
    [key: string]: ModuleItem
}


export function setDifference(setA: Array<any>, setB: Array<any>): Array<any> {
	const _difference = new Set(setA);
	for (const elem of setB) {
		_difference.delete(elem);
	}

	return Array.from(_difference);
}

export class ModuleCache {
    constructor (private context: vscode.ExtensionContext, public cacheKey: string){}

    public read(): CacheState {
        // read the vscode workspace storage state; <Memento> type
        const state: CacheState | undefined = this.context.workspaceState.get(this.cacheKey);
        if (!state) {
            return {};
        }
        return state;
    }

    private update(state: CacheState): void {
        // update the workspace storage state by overwriting it
        this.context.workspaceState.update(this.cacheKey, state);
    }

    public keys(): string[] {
        return Object.keys(this.read());
    }

    public values(): ModuleItem[] {
        return Object.values(this.read());
    }

    public select(uri: vscode.Uri): void {
        // read the state; add / overwrite value with `Object.picked = true`
        let state = this.read();
        state[uri.toString()] = {
            label: uri.path,
            uri: uri,
            picked: true
        };
        this.update(state);
    }

    public unselect(uri: vscode.Uri): void {
         // read the state; add / overwrite value with `Object.picked = false`
        let state = this.read();
        state[uri.toString()] = {
            label: uri.path,
            uri: uri,
            picked: false
        };
        this.update(state);
    }

    public partitionSelection(): {selected: ModuleItem[], unselected: ModuleItem[]} {
        // read the state; return selected and unselected items separetely
        let selected: ModuleItem[] = [];
        let unselected: ModuleItem[] = [];

        this.values().forEach(item => (item.picked === true ? selected : unselected).push(item));
        return {selected: selected, unselected: unselected};
    }
    
    public remove(uri: vscode.Uri): void {
        let state = this.read();
        delete state[uri.toString()];
        this.update(state);
    }
}
