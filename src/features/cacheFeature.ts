import * as vscode from "vscode";
import { EXTENSION_NAME } from "../constants";

interface ICacheState {
  [key: string]: any;
}

export class CacheProvider {
  private readonly cacheKey: string;
  private static instance: CacheProvider;
  private cache: ICacheState;

  constructor(private context: vscode.ExtensionContext, cacheKey: string) {
    this.cacheKey = `${EXTENSION_NAME}.${cacheKey}`;
    this.cache = this.context.globalState.get<ICacheState>(this.cacheKey, {});
  }

  public static getInstance(context: vscode.ExtensionContext, cacheKey: string): CacheProvider {
    if (!CacheProvider.instance) {
      CacheProvider.instance = new CacheProvider(context, cacheKey);
    }

    return CacheProvider.instance;
  }

  // update the workspace storage state by overwriting it
  public async update(): Promise<void> {
    await this.context.workspaceState.update(this.cacheKey, this.cache);
  }

  public add(uri: vscode.Uri): void {
    this.cache[uri.toString()] = uri;
    this.update();
  }

  public remove(uri: vscode.Uri): void {
    delete this.cache[uri.toString()];
    this.update();
  }

  public keys(): string[] {
    return Object.keys(this.cache);
  }

  public values(): any[] {
    return Object.values(this.cache);
  }
}
